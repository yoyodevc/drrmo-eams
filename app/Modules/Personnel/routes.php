<?php

declare(strict_types=1);

use App\Modules\Personnel\Http\Controllers\EmergencyContactController;
use App\Modules\Personnel\Http\Controllers\MyAvailabilityController;
use App\Modules\Personnel\Http\Controllers\RegisterController;
use App\Modules\Personnel\Http\Controllers\RegistrationReviewController;
use App\Modules\Personnel\Http\Controllers\ResendCodeController;
use App\Modules\Personnel\Http\Controllers\VerifyRegistrationController;
use App\Modules\Personnel\Http\Controllers\VolunteerStatusController;
use Illuminate\Support\Facades\Route;

// Public "Request access" for volunteers.
Route::post('/register', RegisterController::class)->middleware('throttle:register');
Route::post('/register/verify', VerifyRegistrationController::class)->middleware('throttle:register-verify');
Route::post('/register/resend', ResendCodeController::class)->middleware('throttle:register-resend');

// Admin review of sign up requests.
Route::middleware('auth:api')->prefix('admin/registrations')->group(function () {
    Route::get('/', [RegistrationReviewController::class, 'index']);
    Route::post('/{user}/approve', [RegistrationReviewController::class, 'approve']);
    Route::post('/{user}/reject', [RegistrationReviewController::class, 'reject']);
});

// Admin switch for volunteer availability, with a reason and a history.
Route::middleware('auth:api')->prefix('admin/volunteers')->group(function () {
    Route::get('/', [VolunteerStatusController::class, 'index']);
    Route::put('/{user}/status', [VolunteerStatusController::class, 'update']);
    Route::get('/{user}/status-history', [VolunteerStatusController::class, 'history']);
});

// A person reads their own availability and its history.
Route::get('/me/availability', MyAvailabilityController::class)->middleware('auth:api');

// A person manages their own emergency contacts. Admin reads someone else's.
Route::middleware('auth:api')->group(function () {
    Route::get('/me/emergency-contacts', [EmergencyContactController::class, 'index']);
    Route::post('/me/emergency-contacts', [EmergencyContactController::class, 'store']);
    Route::put('/me/emergency-contacts/{contact}', [EmergencyContactController::class, 'update']);
    Route::delete('/me/emergency-contacts/{contact}', [EmergencyContactController::class, 'destroy']);
    Route::get('/admin/people/{user}/emergency-contacts', [EmergencyContactController::class, 'forPerson']);
});
