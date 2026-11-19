<?php

declare(strict_types=1);

use App\Modules\Information\Http\Controllers\DirectMessageController;
use App\Modules\Information\Http\Controllers\MemoController;
use App\Modules\Information\Http\Controllers\MyMessageController;
use App\Modules\Information\Http\Controllers\OfficeInboxController;
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

// A person's conversation with the DRRMO office.
Route::get('/me/messages', [MyMessageController::class, 'index']);
Route::post('/me/messages', [MyMessageController::class, 'store'])->middleware('throttle:messages');
Route::post('/me/messages/read', [MyMessageController::class, 'read']);
Route::get('/me/messages/unread', [MyMessageController::class, 'unread']);

// Person-to-person messages. Anyone can write to any active person.
Route::get('/me/chats', [DirectMessageController::class, 'index']);
Route::get('/me/chats/people', [DirectMessageController::class, 'people']);
Route::get('/me/chats/{user}', [DirectMessageController::class, 'show']);
Route::post('/me/chats/{user}', [DirectMessageController::class, 'store'])->middleware('throttle:messages');
Route::post('/me/chats/{user}/read', [DirectMessageController::class, 'read']);

// The DRRMO inbox: one conversation per person.
Route::get('/inbox', [OfficeInboxController::class, 'index']);
Route::get('/inbox/unread', [OfficeInboxController::class, 'unread']);
Route::get('/inbox/{user}', [OfficeInboxController::class, 'show']);
Route::post('/inbox/{user}/reply', [OfficeInboxController::class, 'reply'])->middleware('throttle:messages');
Route::post('/inbox/{user}/read', [OfficeInboxController::class, 'read']);
