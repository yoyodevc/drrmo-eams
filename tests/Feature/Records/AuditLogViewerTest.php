<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
});

it('lets an admin read and filter the audit log', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $other = User::factory()->role(RoleCode::Marshal)->create(['first_name' => 'Zed']);
    AuditLog::query()->create(['actor_id' => $other->id, 'action' => 'event.created', 'entity' => 'event', 'entity_id' => 1, 'meta' => ['title' => 'X']]);
    AuditLog::query()->create(['actor_id' => $admin->id, 'action' => 'role.created', 'entity' => 'role', 'entity_id' => 2]);
    $cookies = loginCookies($admin);

    withAuthCookies($cookies)->getJson('/api/audit-logs')->assertOk()->assertJsonPath('meta.total', 3);
    withAuthCookies($cookies)->getJson('/api/audit-logs?entity=event')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.meta.title', 'X');
    withAuthCookies($cookies)->getJson('/api/audit-logs?actor=Zed')->assertOk()->assertJsonCount(1, 'data');
    withAuthCookies($cookies)->getJson('/api/audit-logs?action=role.')->assertOk()->assertJsonCount(1, 'data');
    withAuthCookies($cookies)->getJson('/api/audit-logs?from=2999-01-01')->assertOk()->assertJsonCount(0, 'data');
});

it('keeps the audit log from people without audit.view', function () {
    $marshal = User::factory()->role(RoleCode::Marshal)->create();

    withAuthCookies(loginCookies($marshal))->getJson('/api/audit-logs')->assertForbidden();
});
