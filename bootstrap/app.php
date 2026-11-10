<?php

declare(strict_types=1);

use App\Http\Middleware\EnsurePrivacyConsent;
use App\Http\Middleware\NoStoreApiResponses;
use App\Http\Middleware\VerifyApiRequestOrigin;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // JWT in HttpOnly cookies (config/jwt.php). Every state changing API call must come from our origin.
        $middleware->api(append: [VerifyApiRequestOrigin::class, EnsurePrivacyConsent::class]);
        // Global, so even the 401 and 403 answers from the auth middleware carry it.
        $middleware->append(NoStoreApiResponses::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
