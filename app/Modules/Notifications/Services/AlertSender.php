<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Services;

use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Jobs\SendNotificationEmail;
use App\Modules\Notifications\Models\Notification;

/**
 * The one way to alert a person in the app and by email. Other channels (push, later) are added here
 * and nowhere else. Each call makes one in app alert (shown at once) and one email (queued).
 */
class AlertSender
{
    /** @param array{assignment_id?: int|null, emergency_report_id?: int|null, site_report_id?: int|null, subject_user_id?: int|null} $about */
    public function send(int $userId, NotificationType $type, array $about = []): void
    {
        $base = ['user_id' => $userId, 'type' => $type->value] + $about;

        Notification::query()->create($base + ['channel' => 'in_app', 'status' => 'sent', 'sent_at' => now()]);
        $email = Notification::query()->create($base + ['channel' => 'email', 'status' => 'queued']);
        SendNotificationEmail::dispatch($email);
    }

    /** True when this person already got this alert for this report, so a repeated run never sends it twice. */
    public function alreadySent(int $userId, NotificationType $type, string $column, int $id): bool
    {
        return Notification::query()->where('user_id', $userId)->where('type', $type->value)->where($column, $id)->where('channel', 'in_app')->exists();
    }
}
