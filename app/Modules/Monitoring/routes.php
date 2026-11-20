<?php

declare(strict_types=1);

use App\Modules\Monitoring\Http\Controllers\DutyController;
use App\Modules\Monitoring\Http\Controllers\EmergencyController;
use App\Modules\Monitoring\Http\Controllers\MapController;
use App\Modules\Monitoring\Http\Controllers\PingController;
use App\Modules\Monitoring\Http\Controllers\ReportFeedController;
use App\Modules\Monitoring\Http\Controllers\ReportReviewerController;
use App\Modules\Monitoring\Http\Controllers\ReportSlotController;
use Illuminate\Support\Facades\Route;

Route::post('/me/assignments/{assignment}/start-duty', [DutyController::class, 'start']);
Route::post('/me/assignments/{assignment}/end-duty', [DutyController::class, 'end']);
Route::post('/me/assignments/{assignment}/pings', [PingController::class, 'store'])->middleware('throttle:pings');
Route::get('/me/report-slots', [ReportSlotController::class, 'index']);
Route::post('/me/report-slots/{report}', [ReportSlotController::class, 'submit'])->middleware('throttle:report-submit');
Route::get('/me/report-slots/{report}/photo', [ReportSlotController::class, 'photo']);
Route::get('/map/latest', [MapController::class, 'latest']);
Route::get('/map/trail/{assignment}', [MapController::class, 'trail']);
Route::get('/reports', [ReportFeedController::class, 'index']);
Route::get('/reports/{report}', [ReportFeedController::class, 'show']);
Route::get('/reports/{report}/photo', [ReportFeedController::class, 'photo']);
Route::post('/me/assignments/{assignment}/emergencies', [EmergencyController::class, 'store'])->middleware('throttle:emergency-submit');
Route::get('/me/emergencies', [EmergencyController::class, 'mine']);
Route::get('/me/emergencies/{emergency}/photo', [EmergencyController::class, 'minePhoto']);
Route::get('/emergencies', [EmergencyController::class, 'index']);
Route::get('/emergencies/{emergency}', [EmergencyController::class, 'show']);
Route::get('/emergencies/{emergency}/photo', [EmergencyController::class, 'photo']);
Route::post('/emergencies/{emergency}/acknowledge', [EmergencyController::class, 'acknowledge']);
Route::post('/emergencies/{emergency}/resolve', [EmergencyController::class, 'resolve']);
Route::get('/report-reviewers', [ReportReviewerController::class, 'show']);
Route::put('/report-reviewers', [ReportReviewerController::class, 'update']);
