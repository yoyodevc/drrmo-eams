<?php

declare(strict_types=1);

return [
    // Minutes an emergency may sit unacknowledged before it goes to the admins again as "escalated".
    'escalate_after_minutes' => 5,

    // Minutes an emergency may sit unacknowledged before the reviewers get one reminder.
    'remind_after_minutes' => 2,
];
