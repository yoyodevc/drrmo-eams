<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Services;

use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Jobs\SendNotificationEmail;
use App\Modules\Notifications\Models\Notification;
use Throwable;

/**
 * The one way to alert a person in the app, by email and by push. Each call makes one in app alert
 * (shown at once), one email (queued) and, for urgent or important alerts, one push (queued).
 */
class AlertSender
{
    public function __construct(private readonly Pusher $pusher) {}

    /** @param array{assignment_id?: int|null, emergency_report_id?: int|null, site_report_id?: int|null, subject_user_id?: int|null} $about */
    public function send(int $userId, NotificationType $type, array $about = []): void
    {
        $base = ['user_id' => $userId, 'type' => $type->value] + $about;

        Notification::query()->create($base + ['channel' => 'in_app', 'status' => 'sent', 'sent_at' => now()]);
        $email = Notification::query()->create($base + ['channel' => 'email', 'status' => 'queued']);
        SendNotificationEmail::dispatch($email);

        // A push problem must never stop the in app alert or the email.
        try {
            [$title, $body] = $type->pushText();
            $code = isset($about['site_report_id']) && in_array($type, [NotificationType::ReportDue, NotificationType::ReportReminder], true)
                ? SiteReport::query()->whereKey($about['site_report_id'])->value('public_code') : null;
            $url = $code === null ? '/' : '/me/reports/'.$code;
            $this->pusher->send($userId, $type, $title, $body, $url, $about);
        } catch (Throwable $e) {
            report($e);
        }
    }

    /** True when this person already got this alert for this report, so a repeated run never sends it twice. */
    public function alreadySent(int $userId, NotificationType $type, string $column, int $id): bool
    {
        return Notification::query()->where('user_id', $userId)->where('type', $type->value)->where($column, $id)->where('channel', 'in_app')->exists();
    }
}
