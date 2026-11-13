<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Jobs\SendNotificationEmail;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Events\LocationConsentWithdrawn;

/**
 * Tells the people who may view locations that someone stopped sharing theirs, so they can reassign.
 * One notification and one email for each of them.
 */
class NotifyAdminsOfWithdrawal
{
    public function handle(LocationConsentWithdrawn $event): void
    {
        $recipients = User::query()
            ->where('account_status', 'active')->whereNull('disabled_at')
            ->whereKeyNot($event->user->getKey())
            ->where(fn ($q) => $q
                ->whereHas('role.permissions', fn ($p) => $p->where('code', 'location.view'))
                ->orWhereHas('grants', fn ($g) => $g->active()))
            ->get()
            ->filter(fn (User $u) => $u->hasPermission('location.view'));

        foreach ($recipients as $admin) {
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
