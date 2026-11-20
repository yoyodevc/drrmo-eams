<?php

declare(strict_types=1);

namespace App\Modules\Records;

use App\Modules\Records\Contracts\AuditLogger;
use App\Modules\Records\Contracts\ConsentChecker;
use App\Modules\Records\Contracts\ConsentRecorder;
use App\Modules\Records\Models\AuditLog;
use App\Modules\Records\Policies\AuditLogPolicy;
use App\Modules\Records\Services\DatabaseAuditLogger;
use App\Modules\Records\Services\DatabaseConsentChecker;
use App\Modules\Records\Services\DatabaseConsentRecorder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class RecordsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(AuditLogger::class, DatabaseAuditLogger::class);
        $this->app->bind(ConsentChecker::class, DatabaseConsentChecker::class);
        $this->app->bind(ConsentRecorder::class, DatabaseConsentRecorder::class);
    }

    public function boot(): void
    {
        Gate::policy(AuditLog::class, AuditLogPolicy::class);
        Route::middleware(['api', 'auth:api'])->prefix('api')->group(__DIR__.'/routes.php');
    }
}
