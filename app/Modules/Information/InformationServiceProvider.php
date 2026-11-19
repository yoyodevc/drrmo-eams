<?php

declare(strict_types=1);

namespace App\Modules\Information;

use App\Modules\Information\Console\ConvertMemoPreviews;
use App\Modules\Information\Contracts\DocumentConverter;
use App\Modules\Information\Models\Memo;
use App\Modules\Information\Models\Message;
use App\Modules\Information\Policies\MemoPolicy;
use App\Modules\Information\Policies\MessagePolicy;
use App\Modules\Information\Services\LibreOfficeConverter;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class InformationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(DocumentConverter::class, fn () => new LibreOfficeConverter(
            config('services.libreoffice.binary'),
            (int) config('services.libreoffice.timeout', 120),
        ));
    }

    public function boot(): void
    {
        Gate::policy(Memo::class, MemoPolicy::class);
        Gate::policy(Message::class, MessagePolicy::class);

        if ($this->app->runningInConsole()) {
            $this->commands([ConvertMemoPreviews::class]);
        }

        Route::middleware(['api', 'auth:api'])->prefix('api')->group(__DIR__.'/routes.php');
    }
}
