<?php

declare(strict_types=1);

namespace App\Modules\Information;

use App\Modules\Information\Models\Memo;
use App\Modules\Information\Policies\MemoPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class InformationServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::policy(Memo::class, MemoPolicy::class);

        Route::middleware(['api', 'auth:api'])->prefix('api')->group(__DIR__.'/routes.php');
    }
}
