<?php

declare(strict_types=1);

use App\Modules\Information\Http\Controllers\MemoController;
use Illuminate\Support\Facades\Route;

// Loaded by InformationServiceProvider under /api with auth:api. Policies run in the controllers.

Route::get('/memos', [MemoController::class, 'index']);
Route::post('/memos', [MemoController::class, 'store']);
Route::get('/memos/{memo}', [MemoController::class, 'show']);
// Browsers cannot send a file with PATCH, so the app sends POST with _method=PATCH.
Route::patch('/memos/{memo}', [MemoController::class, 'update']);
Route::delete('/memos/{memo}', [MemoController::class, 'destroy']);
Route::get('/memos/{memo}/file', [MemoController::class, 'file']);
// The PDF copy of a Word file, for the preview pane.
Route::get('/memos/{memo}/preview', [MemoController::class, 'preview']);
