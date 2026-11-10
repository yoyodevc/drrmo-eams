<?php

declare(strict_types=1);

use App\Modules\Records\Http\Controllers\PrivacyConsentController;
use Illuminate\Support\Facades\Route;

Route::post('/consent/privacy-notice', [PrivacyConsentController::class, 'store']);
