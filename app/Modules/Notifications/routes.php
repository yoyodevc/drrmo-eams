<?php

declare(strict_types=1);

use App\Modules\Notifications\Http\Controllers\AlertController;
use App\Modules\Notifications\Http\Controllers\NotificationController;
use Illuminate\Support\Facades\Route;

Route::get('/me/notifications', [NotificationController::class, 'mine']);
Route::get('/me/alerts', [AlertController::class, 'index']);
Route::post('/me/alerts/read', [AlertController::class, 'read']);
Route::get('/notifications', [NotificationController::class, 'index']);
Route::post('/notifications/{notification}/retry', [NotificationController::class, 'retry']);
