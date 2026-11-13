<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Jobs\SendNotificationEmail;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Services\PermissionHolders;
use App\Modules\Records\Events\LocationConsentWithdrawn;

/**
 * Tells the people who may view locations that someone stopped sharing theirs, so they can reassign.
 * One notification and one email for each of them.
 */
class NotifyAdminsOfWithdrawal
{
    public function __construct(private readonly PermissionHolders $holders) {}

    public function handle(LocationConsentWithdrawn $event): void
    {
        foreach ($this->holders->of('location.view', exceptUserId: (int) $event->user->getKey()) as $admin) {
            $notification = Notification::query()->create([
                'user_id' => $admin->id,
                'subject_user_id' => $event->user->getKey(),
                'type' => NotificationType::ConsentWithdrawn->value,
                'status' => 'queued',
            ]);
            SendNotificationEmail::dispatch($notification);
        }
    }
}
