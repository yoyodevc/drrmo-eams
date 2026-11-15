<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Contracts;

use App\Modules\Events\Models\Assignment;

/**
 * Events calls this after an assignment is created, moved or cancelled, and for each live assignment
 * when an event is published. Each call queues one notification and one email, except on a draft
 * event, where it does nothing.
 */
interface AssignmentNotifier
{
    public function created(Assignment $assignment): void;

    public function changed(Assignment $assignment): void;

    public function cancelled(Assignment $assignment): void;
}
