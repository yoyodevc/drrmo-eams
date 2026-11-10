import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/features/access/api';
import { PermissionMatrix } from './PermissionMatrix';

const role = (over: Partial<Role>): Role => ({
    id: 1,
    code: 'x',
    name: 'X',
    description: null,
    is_system: true,
    is_admin: false,
    is_field: false,
    members_count: 0,
    permissions: ['profile.own'],
    locks: { 'profile.own': { on: true, reason: 'Every role needs this to use the app.' } },
    can_delete: false,
    ...over,
});

const roles: Role[] = [
    role({ id: 1, code: 'coordinator', name: 'Coordinator', members_count: 3 }),
    role({ id: 2, code: 'records', name: 'Records officer', is_system: false }),
];

const save = vi.fn((input: { id: number; permissions: string[] }[]) =>
    Promise.resolve(
        roles.map((r) => ({
            ...r,
            permissions: input.find((i) => i.id === r.id)?.permissions ?? r.permissions,
        })),
    ),
);

vi.mock('@/features/access/api', () => ({
    listRoles: () => Promise.resolve(roles),
    listPermissions: () =>
        Promise.resolve({
            data: [
                {
                    code: 'audit.view',
                    label: 'View audit log',
                    description: 'Read the audit log',
                    group: 'records',
                    admin: true,
                    grantable: true,
                },
                {
                    code: 'profile.own',
                    label: 'Own profile',
                    description: 'Read own profile',
                    group: 'self',
                    admin: false,
                    grantable: false,
                },
            ],
            groups: [
                { key: 'records', label: 'Records and exports' },
                { key: 'self', label: 'Own account' },
            ],
        }),
    saveRolePermissions: (input: { id: number; permissions: string[] }[]) => save(input),
}));

function renderMatrix() {
    render(
        <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter>
                <PermissionMatrix />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

afterEach(() => {
    cleanup();
    save.mockClear();
});

describe('PermissionMatrix', () => {
    it('collects ticks, counts them and saves only the changed roles', async () => {
        renderMatrix();
        const cell = await screen.findByRole('checkbox', {
            name: 'Records officer: View audit log',
        });
        expect(cell).toHaveAttribute('aria-checked', 'false');

        fireEvent.click(cell);
        expect(cell).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByText(/unsaved change\./)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
        expect(save.mock.calls[0][0]).toEqual([
            { id: 2, permissions: ['audit.view', 'profile.own'] },
        ]);
    });

    it('does not change a locked cell and says why', async () => {
        renderMatrix();
        const locked = await screen.findByRole('checkbox', {
            name: 'Coordinator: Own profile. Locked. Every role needs this to use the app.',
        });

        fireEvent.click(locked);
        expect(locked).toHaveAttribute('aria-checked', 'true');
        expect(locked).toHaveAttribute('aria-disabled', 'true');
    });

    it('filters permissions by name', async () => {
        renderMatrix();
        await screen.findByText('View audit log');

        fireEvent.change(screen.getByLabelText('Find a permission'), {
            target: { value: 'audit' },
        });
        const table = within(screen.getByRole('table'));
        expect(table.getByText('View audit log')).toBeInTheDocument();
        expect(table.queryByText('Own profile')).toBeNull();
    });
});
