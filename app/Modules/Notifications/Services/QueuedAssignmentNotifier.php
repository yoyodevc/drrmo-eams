<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Services;

use App\Modules\Events\Enums\EventStatus;
use App\Modules\Events\Models\Assignment;
use App\Modules\Notifications\Contracts\AssignmentNotifier;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Jobs\SendNotificationEmail;
use App\Modules\Notifications\Models\Notification;

class QueuedAssignmentNotifier implements AssignmentNotifier
{
    public function created(Assignment $assignment): void
    {
        $this->queue($assignment, NotificationType::AssignmentCreated);
    }

    public function changed(Assignment $assignment): void
    {
        $this->queue($assignment, NotificationType::AssignmentChanged);
    }

    public function cancelled(Assignment $assignment): void
    {
        $this->queue($assignment, NotificationType::AssignmentCancelled);
    }

    private function queue(Assignment $assignment, NotificationType $type): void
    {
        // A draft is not public yet, so nobody hears about it. Publishing sends the emails (USER_FLOWS 1, step 5).
        if ($assignment->event?->status === EventStatus::Draft) {
            return;
        }

        $notification = Notification::query()->create([
            'user_id' => $assignment->user_id,
            'assignment_id' => $assignment->id,
            'type' => $type->value,
            'status' => 'queued',
        ]);
        SendNotificationEmail::dispatch($notification);
    }
}
