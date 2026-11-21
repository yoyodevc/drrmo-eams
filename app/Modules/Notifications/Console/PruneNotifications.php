<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Console;

use App\Modules\Notifications\Models\Notification;
use Illuminate\Console\Command;

/** Deletes notification log rows older than 6 months, in chunks. */
class PruneNotifications extends Command
{
    public const RETENTION_MONTHS = 6;

    protected $signature = 'notifications:prune';

    protected $description = 'Delete notifications older than 6 months';

    public function handle(): int
    {
        $cutoff = now()->subMonths(self::RETENTION_MONTHS);
        $total = 0;

        do {
            $deleted = Notification::query()->where('created_at', '<', $cutoff)->limit(5000)->delete();
            $total += $deleted;
        } while ($deleted === 5000);

        $this->info("Pruned {$total} notifications older than {$cutoff->toDateString()}.");

        return self::SUCCESS;
    }
}
