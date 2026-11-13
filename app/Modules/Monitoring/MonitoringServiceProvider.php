<?php

declare(strict_types=1);

namespace App\Modules\Monitoring;

use App\Modules\Monitoring\Console\AutoEndDuty;
use App\Modules\Monitoring\Console\CreateReportSlots;
use App\Modules\Monitoring\Console\PurgePings;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class MonitoringServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([AutoEndDuty::class, CreateReportSlots::class, PurgePings::class]);
            $this->callAfterResolving(Schedule::class, function (Schedule $schedule) {
                $schedule->command('monitoring:auto-end-duty')->everyFiveMinutes();
                $schedule->command('monitoring:create-report-slots')->everyFiveMinutes();
                $schedule->command('monitoring:purge-pings')->dailyAt('02:00');
            });
        }

        Route::middleware(['api', 'auth:api'])->prefix('api')->group(__DIR__.'/routes.php');
    }
}
