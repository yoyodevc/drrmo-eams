<?php

declare(strict_types=1);

use App\Modules\Notifications\Http\Controllers\AlertController;
use App\Modules\Notifications\Http\Controllers\NotificationController;
use App\Modules\Notifications\Http\Controllers\PushController;
use Illuminate\Support\Facades\Route;

Route::get('/me/notifications', [NotificationController::class, 'mine']);
Route::get('/me/alerts', [AlertController::class, 'index']);
Route::post('/me/alerts/read', [AlertController::class, 'read']);
Route::get('/notifications', [NotificationController::class, 'index']);
Route::post('/notifications/{notification}/retry', [NotificationController::class, 'retry']);
Route::get('/me/push', [PushController::class, 'show']);
Route::put('/me/alert-settings', [PushController::class, 'settings']);
Route::post('/push/subscribe', [PushController::class, 'subscribe']);
Route::delete('/push/subscribe', [PushController::class, 'unsubscribe']);
Route::delete('/push/devices/{subscription}', [PushController::class, 'destroy']);
Route::post('/push/test', [PushController::class, 'test'])->middleware('throttle:6,1');
