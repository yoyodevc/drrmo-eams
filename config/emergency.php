<?php

declare(strict_types=1);

return [
    // Minutes an emergency may sit unacknowledged before it goes to the admins again as "escalated".
    'escalate_after_minutes' => 5,

    // The two marshals who review every emergency, whatever the event. A stand-in until the settings
    // screen exists (report rework step 2): a comma separated list of user ids in EMERGENCY_REVIEWER_IDS.
    'reviewer_ids' => array_values(array_filter(array_map('intval', explode(',', (string) env('EMERGENCY_REVIEWER_IDS', ''))))),
];
