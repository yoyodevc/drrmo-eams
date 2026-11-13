<?php

declare(strict_types=1);

namespace App\Modules\Monitoring;

use App\Modules\Monitoring\Console\AutoEndDuty;
use App\Modules\Monitoring\Console\CreateReportSlots;
use App\Modules\Monitoring\Console\PurgePings;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Monitoring\Policies\SiteReportPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class MonitoringServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::policy(SiteReport::class, SiteReportPolicy::class);
        // 6 report uploads a minute per person (docs/SECURITY_AND_PRIVACY.md section 6).
        RateLimiter::for('report-submit', fn (Request $request) => Limit::perMinute(6)
            ->by((string) ($request->user()?->getAuthIdentifier() ?? $request->ip()))
            ->response(fn () => response()->json(['message' => 'Too many reports sent. Try again in a minute.', 'code' => 'too_many_reports'], 429)));

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
