// Typed calls to the Access module: grants (S2.6, S2.7).
import { api } from '@/shared/api/client';

export type GrantStatus = 'active' | 'upcoming' | 'ended' | 'revoked';

export interface Grant {
    id: number;
    permission: { code: string; label: string; description: string };
    person: { id: number; name: string | null };
    event: { id: number; title: string } | null;
    starts_at: string;
    ends_at: string;
    reason: string;
    status: GrantStatus;
    granted_by: string | null;
    revoked_at: string | null;
    revoked_by: string | null;
}

export interface NewGrant {
    user_id: number;
    permission: string;
    event_id: number | null;
    // ISO 8601 with offset.
    starts_at: string;
    ends_at: string;
    reason: string;
}

export interface GrantOption {
    code: string;
    label: string;
    group: string;
    // Plain words from the permission matrix, for example "List and view all people".
    description: string;
    needs_event: boolean;
    max_days: number | null;
}

export async function grantOptions(): Promise<GrantOption[]> {
    const body = await api<{ data: GrantOption[] }>('/api/grantable-permissions');
    return body.data;
}

// One person's grants, or every grant when no person is given.
export async function listGrants(userId?: number): Promise<Grant[]> {
    const body = await api<{ data: Grant[] }>(
        userId ? `/api/grants?user=${userId}` : '/api/grants',
    );
    return body.data;
}

export async function createGrant(input: NewGrant): Promise<Grant> {
    const body = await api<{ data: Grant }>('/api/grants', {
        method: 'POST',
        body: JSON.stringify(input),
    });
    return body.data;
}

export async function revokeGrant(id: number): Promise<Grant> {
    const body = await api<{ data: Grant }>(`/api/grants/${id}/revoke`, { method: 'POST' });
    return body.data;
}

export async function myGrants(): Promise<Grant[]> {
    const body = await api<{ data: Grant[] }>('/api/me/grants');
    return body.data;
}

// Roles and the permission matrix (RBAC).

export interface PermissionDef {
    code: string;
    // Short name, for example "View people".
    label: string;
    // One sentence, for example "List and view all people".
    description: string;
    group: string;
    // Opens an admin screen or action.
    admin: boolean;
    grantable: boolean;
}

export interface PermissionGroup {
    key: string;
    label: string;
}

export interface Role {
    id: number;
    code: string;
    name: string;
    description: string | null;
    // Built-in roles cannot be renamed or deleted.
    is_system: boolean;
    is_admin: boolean;
    // Marshal and Volunteer, the roles events staff by.
    is_field: boolean;
    members_count: number;
    permissions: string[];
    // Cells nobody may change: on says whether the role must hold it.
    locks: Record<string, { on: boolean; reason: string }>;
    can_delete: boolean;
}

export interface RoleOption {
    code: string;
    name: string;
    is_system: boolean;
    // False when this role has access the signed-in person does not hold.
    can_assign: boolean;
}

export async function listPermissions(): Promise<{
    data: PermissionDef[];
    groups: PermissionGroup[];
}> {
    return api('/api/permissions');
}

export async function listRoles(): Promise<Role[]> {
    const body = await api<{ data: Role[] }>('/api/roles');
    return body.data;
}

export async function getRole(id: number): Promise<Role> {
    const body = await api<{ data: Role }>(`/api/roles/${id}`);
    return body.data;
}

export async function roleOptions(): Promise<RoleOption[]> {
    const body = await api<{ data: RoleOption[] }>('/api/role-options');
    return body.data;
}

export async function createRole(input: {
    name: string;
    description: string;
    copy_from: number | null;
}): Promise<Role> {
    const body = await api<{ data: Role }>('/api/roles', {
        method: 'POST',
        body: JSON.stringify({ ...input, description: input.description.trim() || null }),
    });
    return body.data;
}

export async function updateRole(
    id: number,
    input: { name: string; description: string },
): Promise<Role> {
    const body = await api<{ data: Role }>(`/api/roles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...input, description: input.description.trim() || null }),
    });
    return body.data;
}

export async function deleteRole(id: number): Promise<void> {
    await api(`/api/roles/${id}`, { method: 'DELETE' });
}

// Saves several roles at once. All or nothing.
export async function saveRolePermissions(
    roles: { id: number; permissions: string[] }[],
): Promise<Role[]> {
    const body = await api<{ data: Role[] }>('/api/roles/permissions', {
        method: 'PUT',
        body: JSON.stringify({ roles }),
    });
    return body.data;
}

export async function addRoleMembers(roleId: number, userIds: number[]): Promise<Role> {
    const body = await api<{ data: Role }>(`/api/roles/${roleId}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: userIds }),
    });
    return body.data;
}

export interface MyAccess {
    role: { code: string; name: string; description: string | null } | null;
    permissions: (Omit<PermissionDef, 'grantable'> & { admin: boolean })[];
}

export async function myAccess(): Promise<MyAccess> {
    const body = await api<{ data: MyAccess }>('/api/me/access');
    return body.data;
}
