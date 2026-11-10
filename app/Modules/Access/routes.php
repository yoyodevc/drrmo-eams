<?php

declare(strict_types=1);

use App\Modules\Access\Http\Controllers\GrantController;
use App\Modules\Access\Http\Controllers\MyGrantController;
use Illuminate\Support\Facades\Route;

Route::get('/grants', [GrantController::class, 'index']);
Route::post('/grants', [GrantController::class, 'store']);
Route::post('/grants/{grant}/revoke', [GrantController::class, 'revoke']);
Route::get('/me/grants', MyGrantController::class);
