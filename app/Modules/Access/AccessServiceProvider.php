<?php

declare(strict_types=1);

namespace App\Modules\Access;

use App\Modules\Access\Contracts\PermissionChecker;
use App\Modules\Access\Contracts\RoleGuard;
use App\Modules\Access\Models\PermissionGrant;
use App\Modules\Access\Models\Role;
use App\Modules\Access\Policies\GrantPolicy;
use App\Modules\Access\Policies\RolePolicy;
use App\Modules\Access\Services\GrantAwarePermissionChecker;
use App\Modules\Access\Services\PermissionRoleGuard;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AccessServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PermissionChecker::class, GrantAwarePermissionChecker::class);
        $this->app->bind(RoleGuard::class, PermissionRoleGuard::class);
    }

    public function boot(): void
    {
        Gate::policy(PermissionGrant::class, GrantPolicy::class);
        Gate::policy(Role::class, RolePolicy::class);

        Route::middleware(['api', 'auth:api'])->prefix('api')->group(__DIR__.'/routes.php');
    }
}
