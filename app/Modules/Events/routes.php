<?php

declare(strict_types=1);

use App\Modules\Events\Http\Controllers\AcknowledgeController;
use App\Modules\Events\Http\Controllers\AssignmentController;
use App\Modules\Events\Http\Controllers\CalendarController;
use App\Modules\Events\Http\Controllers\DashboardController;
use App\Modules\Events\Http\Controllers\DutyTypeController;
use App\Modules\Events\Http\Controllers\EventController;
use App\Modules\Events\Http\Controllers\EventNoticeController;
use App\Modules\Events\Http\Controllers\EventTypeController;
use App\Modules\Events\Http\Controllers\LocationController;
use App\Modules\Events\Http\Controllers\LookupController;
use App\Modules\Events\Http\Controllers\MyAssignmentController;
use App\Modules\Events\Http\Controllers\RequirementController;
use Illuminate\Support\Facades\Route;

Route::get('/event-lookups', LookupController::class);

Route::get('/event-types', [EventTypeController::class, 'index']);
Route::post('/event-types', [EventTypeController::class, 'store']);
Route::patch('/event-types/{event_type}', [EventTypeController::class, 'update']);
Route::delete('/event-types/{event_type}', [EventTypeController::class, 'destroy']);

Route::get('/duty-types', [DutyTypeController::class, 'index']);
Route::post('/duty-types', [DutyTypeController::class, 'store']);
Route::patch('/duty-types/{duty_type}', [DutyTypeController::class, 'update']);
Route::delete('/duty-types/{duty_type}', [DutyTypeController::class, 'destroy']);

Route::get('/campus-locations', [LocationController::class, 'index']);
Route::post('/campus-locations', [LocationController::class, 'store']);
Route::patch('/campus-locations/{campus_location}', [LocationController::class, 'update']);
Route::delete('/campus-locations/{campus_location}', [LocationController::class, 'destroy']);

Route::get('/events', [EventController::class, 'index']);
Route::post('/events', [EventController::class, 'store']);
Route::get('/events/calendar', CalendarController::class);
Route::get('/events/{event}', [EventController::class, 'show']);
Route::put('/events/{event}', [EventController::class, 'update']);
Route::post('/events/{event}/publish', [EventController::class, 'publish']);
Route::post('/events/{event}/cancel', [EventController::class, 'cancel']);
Route::post('/events/{event}/requirements', [RequirementController::class, 'store']);
Route::delete('/requirements/{requirement}', [RequirementController::class, 'destroy']);
Route::get('/requirements/{requirement}/candidates', [AssignmentController::class, 'candidates']);
Route::post('/requirements/{requirement}/assignments', [AssignmentController::class, 'store']);
Route::delete('/assignments/{assignment}', [AssignmentController::class, 'destroy']);
Route::get('/me/assignments', MyAssignmentController::class);
Route::post('/me/assignments/{assignment}/acknowledge', AcknowledgeController::class);
Route::get('/me/event-notices', EventNoticeController::class);
Route::get('/dashboard', DashboardController::class);
Route::patch('/assignments/{assignment}', [AssignmentController::class, 'update']);
Route::post('/assignments/{assignment}/cancel', [AssignmentController::class, 'cancel']);
Route::post('/assignments/{assignment}/no-show', [AssignmentController::class, 'noShow']);
