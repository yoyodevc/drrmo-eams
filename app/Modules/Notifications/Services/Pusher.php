<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Services;

use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Enums\Urgency;
use App\Modules\Notifications\Jobs\SendPush;
use App\Modules\Notifications\Models\AlertPreference;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\PushSubscription;

/**
 * The one door to Web Push. Other modules never call it: AlertSender does. A push is skipped when the
 * person has no device, muted push, or (for important alerts) is in quiet hours. Urgent alerts ignore
 * mute and quiet hours.
 */
class Pusher
{
    /** @param array<string, int|null> $about the same columns AlertSender stores on the log row */
    public function send(int $userId, NotificationType $type, string $title, string $body, string $url, array $about = []): bool
    {
        $urgency = $type->urgency();
        if ($urgency === Urgency::Normal || ! PushSubscription::query()->where('user_id', $userId)->exists()) {
            return false;
        }

        $prefs = AlertPreference::query()->find($userId);
        if ($urgency !== Urgency::Urgent && $prefs !== null && ($prefs->push_muted || $prefs->quietAt(now()))) {
            return false;
        }

        $row = Notification::query()->create(['user_id' => $userId, 'type' => $type->value, 'channel' => 'push', 'status' => 'queued'] + $about);
        $urgent = $urgency === Urgency::Urgent;
        $job = new SendPush($row, ['title' => $title, 'body' => $body, 'url' => $url, 'urgent' => $urgent, 'tag' => $type->value]);
        dispatch($urgent ? $job->onQueue('high') : $job);

        return true;
    }
}
