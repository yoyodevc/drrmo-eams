<?php

declare(strict_types=1);

use App\Modules\Access\Http\Controllers\GrantController;
use App\Modules\Access\Http\Controllers\MyAccessController;
use App\Modules\Access\Http\Controllers\MyGrantController;
use App\Modules\Access\Http\Controllers\PermissionController;
use App\Modules\Access\Http\Controllers\RoleController;
use App\Modules\Access\Http\Controllers\RoleMemberController;
use App\Modules\Access\Http\Controllers\RolePermissionController;
use Illuminate\Support\Facades\Route;

// Roles and the permission matrix.
Route::get('/permissions', PermissionController::class);
Route::get('/roles', [RoleController::class, 'index']);
Route::get('/role-options', [RoleController::class, 'options']);
Route::post('/roles', [RoleController::class, 'store']);
Route::put('/roles/permissions', RolePermissionController::class);
Route::get('/roles/{role}', [RoleController::class, 'show']);
Route::patch('/roles/{role}', [RoleController::class, 'update']);
Route::delete('/roles/{role}', [RoleController::class, 'destroy']);
Route::post('/roles/{role}/members', [RoleMemberController::class, 'store']);

// Time-limited grants.
Route::get('/grantable-permissions', [GrantController::class, 'options']);
Route::get('/grants', [GrantController::class, 'index']);
Route::post('/grants', [GrantController::class, 'store']);
Route::post('/grants/{grant}/revoke', [GrantController::class, 'revoke']);
Route::get('/me/grants', MyGrantController::class);
Route::get('/me/access', MyAccessController::class);
