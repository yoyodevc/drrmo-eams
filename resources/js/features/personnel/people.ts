// Calls for the people list and profile (Personnel module, S2.1).
import { ApiError, api } from '@/shared/api/client';
import type { Availability } from '@/features/personnel/volunteers';

export type RoleCode = 'admin' | 'marshal' | 'volunteer' | 'coordinator';

export const roleLabels: Record<RoleCode, string> = {
    admin: 'Admin',
    marshal: 'Marshal',
    volunteer: 'Volunteer',
    coordinator: 'Coordinator',
};

export interface Person {
    id: number;
    first_name: string;
    last_name: string;
    name: string;
    email: string;
    contact_number: string | null;
    role: RoleCode | null;
    team: string | null;
    team_name: string | null;
    department: { id: number; name: string } | null;
    status: Availability;
    account_status: string;
    last_login_at: string | null;
    created_at: string | null;
}

export interface PersonInput {
    first_name: string;
    last_name: string;
    email: string;
    contact_number: string;
    role: RoleCode;
    team: string;
    department_id: string;
}

export interface PeopleFilters {
    search: string;
    role: string;
    team: string;
    status: string;
    department: string;
    page: number;
}

export interface Department {
    id: number;
    name: string;
    active: boolean;
    people_count: number;
}

export interface Team {
    code: string;
    name: string;
    active: boolean;
    people_count: number;
}

export type OrgKind = 'teams' | 'departments';

export async function listPeople(
    filters: PeopleFilters,
): Promise<{ data: Person[]; meta: { page: number; last_page: number; total: number } }> {
    const params = new URLSearchParams();
    for (const key of ['search', 'role', 'team', 'status', 'department'] as const) {
        if (filters[key].trim() !== '') params.set(key, filters[key].trim());
    }
    if (filters.page > 1) params.set('page', String(filters.page));
    const query = params.toString();
    return api(`/api/people${query ? `?${query}` : ''}`);
}

export async function getPerson(id: number): Promise<Person> {
    const body = await api<{ data: Person }>(`/api/people/${id}`);
    return body.data;
}

export async function savePerson(
    id: number | null,
    input: PersonInput,
): Promise<{ data: Person; invite_sent?: boolean }> {
    return api(id === null ? '/api/people' : `/api/people/${id}`, {
        method: id === null ? 'POST' : 'PATCH',
        body: JSON.stringify({
            ...input,
            team: input.team === '' ? null : input.team,
            department_id: input.department_id === '' ? null : Number(input.department_id),
            contact_number: input.contact_number.trim() === '' ? null : input.contact_number,
        }),
    });
}

export async function resendInvite(id: number): Promise<boolean> {
    const body = await api<{ invite_sent: boolean }>(`/api/people/${id}/invite`, {
        method: 'POST',
    });
    return body.invite_sent;
}

export async function listDepartments(): Promise<Department[]> {
    const body = await api<{ data: Department[] }>('/api/departments');
    return body.data;
}

export async function listTeams(): Promise<Team[]> {
    const body = await api<{ data: Team[] }>('/api/teams');
    return body.data;
}

/** Add (key null) or edit a team or department. A team is keyed by its code, a department by its id. */
export async function saveOrgUnit(
    kind: OrgKind,
    key: string | number | null,
    input: { name: string; active: boolean },
): Promise<void> {
    await api(key === null ? `/api/${kind}` : `/api/${kind}/${key}`, {
        method: key === null ? 'POST' : 'PATCH',
        body: JSON.stringify(input),
    });
}

export async function deleteOrgUnit(kind: OrgKind, key: string | number): Promise<void> {
    await api(`/api/${kind}/${key}`, { method: 'DELETE' });
}

export interface MyProfileData {
    name: string;
    email: string;
    contact_number: string | null;
    role: RoleCode | null;
    team: string | null;
    team_name: string | null;
    department: string | null;
}

export async function getMyProfile(): Promise<MyProfileData> {
    const body = await api<{ data: MyProfileData }>('/api/me/profile');
    return body.data;
}

export async function saveMyContactNumber(contactNumber: string): Promise<MyProfileData> {
    const body = await api<{ data: MyProfileData }>('/api/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
            contact_number: contactNumber.trim() === '' ? null : contactNumber,
        }),
    });
    return body.data;
}

export function fieldErrors(error: unknown): Record<string, string> {
    if (!(error instanceof ApiError) || error.status !== 422) return {};
    const raw = (error.body as { errors?: Record<string, string[]> } | null)?.errors ?? {};
    return Object.fromEntries(Object.entries(raw).map(([key, list]) => [key, list[0]]));
}

export function errorMessage(error: unknown): string {
    if (error instanceof ApiError && error.status === 422) {
        const text = (error.body as { message?: string } | null)?.message;
        if (text) return text;
    }
    return 'That did not save. Check your connection and try again.';
}

export interface ImportIssue {
    /** Line in the file. The header is line 1, and 0 means the whole file. */
    row: number;
    field: string;
    message: string;
}

export interface ImportResult {
    count: number;
    imported: boolean;
    invites_failed?: string[];
}

/** Check a people CSV (check true) or save it. A file with any bad row saves nothing. */
export async function importPeople(
    file: File,
    check: boolean,
): Promise<
    { ok: true; result: ImportResult } | { ok: false; issues: ImportIssue[]; message: string }
> {
    const body = new FormData();
    body.append('file', file);
    if (check) body.append('check', '1');
    try {
        return {
            ok: true,
            result: await api<ImportResult>('/api/people/import', { method: 'POST', body }),
        };
    } catch (error) {
        if (error instanceof ApiError && error.status === 422) {
            const data = error.body as { message?: string; errors?: unknown } | null;
            const raw = data?.errors;
            // Row problems are a list. A plain validation error (wrong file type) is an object.
            const issues: ImportIssue[] = Array.isArray(raw)
                ? (raw as ImportIssue[])
                : Object.values((raw as Record<string, string[]>) ?? {}).flatMap((m) =>
                      m.map((message) => ({ row: 0, field: 'file', message })),
                  );
            return {
                ok: false,
                issues,
                message: data?.message ?? 'The file could not be imported.',
            };
        }
        throw error;
    }
}
