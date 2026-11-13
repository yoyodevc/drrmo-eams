<?php

declare(strict_types=1);

use App\Modules\Monitoring\Http\Controllers\DutyController;
use App\Modules\Monitoring\Http\Controllers\PingController;
use Illuminate\Support\Facades\Route;

Route::post('/me/assignments/{assignment}/start-duty', [DutyController::class, 'start']);
Route::post('/me/assignments/{assignment}/end-duty', [DutyController::class, 'end']);
Route::post('/me/assignments/{assignment}/pings', [PingController::class, 'store'])->middleware('throttle:pings');
