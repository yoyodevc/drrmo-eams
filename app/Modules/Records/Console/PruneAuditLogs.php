<?php

declare(strict_types=1);

namespace App\Modules\Records\Console;

use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Deletes audit rows older than 3 years. This is the only place audit rows are removed. It uses the
 * query builder because the model blocks deletes on purpose, and it writes one audit row of its own.
 */
class PruneAuditLogs extends Command
{
    public const RETENTION_YEARS = 3;

    private const CHUNK = 5000;

    protected $signature = 'records:prune-audit-logs';

    protected $description = 'Delete audit rows older than 3 years';

    public function handle(AuditLogger $audit): int
    {
        $cutoff = now()->subYears(self::RETENTION_YEARS);
        $total = 0;

        do {
            $deleted = DB::table('audit_logs')->where('created_at', '<', $cutoff)->limit(self::CHUNK)->delete();
            $total += $deleted;
        } while ($deleted === self::CHUNK);

        if ($total > 0) {
            $audit->log('records.pruned', 'audit_log', null, ['deleted' => $total, 'before' => $cutoff->toDateString()]);
        }
        $this->info("Pruned {$total} audit rows older than {$cutoff->toDateString()}.");

        return self::SUCCESS;
    }
}
