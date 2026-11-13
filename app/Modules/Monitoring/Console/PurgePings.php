<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Console;

use App\Modules\Monitoring\Models\LocationPing;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Console\Command;

/** Deletes pings older than 10 working days (Monday to Friday), in chunks so the table is never locked for long. */
class PurgePings extends Command
{
    public const RETENTION_WORKING_DAYS = 10;

    private const CHUNK = 5000;

    protected $signature = 'monitoring:purge-pings';

    protected $description = 'Delete location pings older than 10 working days';

    /** Start of the day that is $days working days before $now. Pings captured before it are purged. */
    public static function cutoff(CarbonInterface $now, int $days = self::RETENTION_WORKING_DAYS): CarbonImmutable
    {
        $day = CarbonImmutable::instance($now)->startOfDay();
        while ($days > 0) {
            $day = $day->subDay();
            if ($day->isWeekday()) {
                $days--;
            }
        }

        return $day;
    }

    public function handle(): int
    {
        $cutoff = self::cutoff(now());
        $total = 0;

        do {
            $deleted = LocationPing::query()->where('captured_at', '<', $cutoff)->limit(self::CHUNK)->delete();
            $total += $deleted;
            if ($deleted === self::CHUNK) {
                usleep(200_000);
            }
        } while ($deleted === self::CHUNK);

        $this->info("Purged {$total} pings older than {$cutoff->toDateString()}.");

        return self::SUCCESS;
    }
}
