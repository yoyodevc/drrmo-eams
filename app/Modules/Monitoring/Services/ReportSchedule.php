<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Services;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/** When site reports are due (docs/PROJECT_PLAN.md A4). Pure date maths, so it is easy to test. */
class ReportSchedule
{
    public const EVERY_HOURS = 2;

    /** @return list<CarbonImmutable> Due times for one shift, oldest first. */
    public function dueTimes(CarbonInterface $start, CarbonInterface $end): array
    {
        $start = CarbonImmutable::instance($start);
        $end = CarbonImmutable::instance($end);

        // A shift shorter than two hours gets one slot, due at the end.
        if ($start->addHours(self::EVERY_HOURS)->gt($end)) {
            return [$end];
        }

        $times = [];
        for ($due = $start->addHours(self::EVERY_HOURS); $due->lte($end); $due = $due->addHours(self::EVERY_HOURS)) {
            $times[] = $due;
        }

        return $times;
    }
}
