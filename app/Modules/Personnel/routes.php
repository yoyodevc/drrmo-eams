<?php

declare(strict_types=1);

use App\Modules\Personnel\Http\Controllers\DepartmentController;
use App\Modules\Personnel\Http\Controllers\EmergencyContactController;
use App\Modules\Personnel\Http\Controllers\MyAvailabilityController;
use App\Modules\Personnel\Http\Controllers\MyProfileController;
use App\Modules\Personnel\Http\Controllers\PeopleController;
use App\Modules\Personnel\Http\Controllers\PeopleImportController;
use App\Modules\Personnel\Http\Controllers\RegisterController;
use App\Modules\Personnel\Http\Controllers\RegistrationReviewController;
use App\Modules\Personnel\Http\Controllers\ResendCodeController;
use App\Modules\Personnel\Http\Controllers\TeamController;
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

// A person reads their own profile and edits their contact number.
Route::middleware('auth:api')->group(function () {
    Route::get('/me/profile', [MyProfileController::class, 'show']);
    Route::patch('/me/profile', [MyProfileController::class, 'update']);
});

// Admin people list, profile, create and edit. A new person gets a set-password email.
Route::middleware('auth:api')->group(function () {
    Route::get('/people', [PeopleController::class, 'index']);
    Route::post('/people', [PeopleController::class, 'store']);
    Route::get('/people/import/template', [PeopleImportController::class, 'template']);
    Route::post('/people/import', [PeopleImportController::class, 'store']);
    Route::get('/people/{user}', [PeopleController::class, 'show']);
    Route::patch('/people/{user}', [PeopleController::class, 'update']);
    Route::post('/people/{user}/invite', [PeopleController::class, 'invite']);
    Route::get('/departments', [DepartmentController::class, 'index']);
    Route::post('/departments', [DepartmentController::class, 'store']);
    Route::patch('/departments/{department}', [DepartmentController::class, 'update']);
    Route::delete('/departments/{department}', [DepartmentController::class, 'destroy']);
    Route::get('/teams', [TeamController::class, 'index']);
    Route::post('/teams', [TeamController::class, 'store']);
    Route::patch('/teams/{team}', [TeamController::class, 'update']);
    Route::delete('/teams/{team}', [TeamController::class, 'destroy']);
});
