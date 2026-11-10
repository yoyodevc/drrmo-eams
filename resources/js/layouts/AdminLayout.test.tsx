import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { adminEntries } from '@/app/adminAccess';
import { AdminLayout } from './AdminLayout';

const admin = {
    id: 1,
    first_name: 'Test',
    last_name: 'Admin',
    name: 'Test Admin',
    email: 'admin@example.test',
    role: 'admin',
    team: null,
    status: 'active',
    // An admin holds every admin permission through the role.
    permissions: adminEntries.map((e) => e.permission),
    consent: { privacy_notice: true, location_tracking: false },
    home: '/admin',
};

function renderAt(path: string) {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['me'], admin);
    const router = createMemoryRouter(
        [
            {
                path: '/admin',
                element: <AdminLayout />,
                children: [
                    { index: true, element: <p>Dashboard page</p> },
                    { path: 'events/:id', element: <p>Event page</p> },
                ],
            },
        ],
        { initialEntries: [path] },
    );
    render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    );
}

afterEach(cleanup);

describe('AdminLayout', () => {
    it('marks Events as current on an event detail page, not Dashboard', () => {
        renderAt('/admin/events/5');
        const sidebar = within(screen.getByRole('complementary'));

        expect(sidebar.getByRole('link', { name: 'Events' })).toHaveAttribute(
            'aria-current',
            'page',
        );
        expect(sidebar.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
            'aria-current',
        );
        expect(sidebar.getByText('Test Admin')).toBeInTheDocument();
        expect(sidebar.getByText('Administrator')).toBeInTheDocument();
    });

    it('opens the phone menu and closes it after a link is chosen', () => {
        renderAt('/admin/events/5');
        const toggle = screen.getByRole('button', { name: 'Open menu' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(toggle);
        const menu = within(document.getElementById('admin-menu')!);
        expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
            'aria-expanded',
            'true',
        );

        fireEvent.click(menu.getByRole('link', { name: 'Dashboard' }));
        expect(document.getElementById('admin-menu')).toBeNull();
        expect(screen.getByText('Dashboard page')).toBeInTheDocument();
    });

    it('closes the phone menu with Escape', () => {
        renderAt('/admin');
        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(document.getElementById('admin-menu')).toBeNull();
    });
});

describe('AdminLayout for a granted person', () => {
    it('shows only the screens the grant opens, and a way back', () => {
        const queryClient = new QueryClient();
        queryClient.setQueryData(['me'], {
            ...admin,
            role: 'marshal',
            home: '/me',
            permissions: ['people.view'],
        });
        const router = createMemoryRouter(
            [
                {
                    path: '/admin',
                    element: <AdminLayout />,
                    children: [{ path: 'people', element: <p>People page</p> }],
                },
            ],
            { initialEntries: ['/admin/people'] },
        );
        render(
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>,
        );
        const sidebar = within(screen.getByRole('complementary'));

        expect(sidebar.getByRole('link', { name: 'People' })).toBeInTheDocument();
        expect(sidebar.getByRole('link', { name: 'My duties' })).toBeInTheDocument();
        expect(sidebar.queryByRole('link', { name: 'Events' })).toBeNull();
        expect(screen.getByText('People page')).toBeInTheDocument();
    });

    it('blocks a screen the person has no permission for', () => {
        const queryClient = new QueryClient();
        queryClient.setQueryData(['me'], {
            ...admin,
            role: 'marshal',
            home: '/me',
            permissions: ['people.view'],
        });
        const router = createMemoryRouter(
            [
                {
                    path: '/admin',
                    element: <AdminLayout />,
                    children: [{ path: 'events', element: <p>Events page</p> }],
                },
            ],
            { initialEntries: ['/admin/events'] },
        );
        render(
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>,
        );

        expect(screen.getByText('No access to this screen')).toBeInTheDocument();
        expect(screen.queryByText('Events page')).toBeNull();
    });
});

describe('AdminLayout access control group', () => {
    it('shows Roles, Permission matrix and Temporary access to an admin', () => {
        renderAt('/admin');
        const sidebar = within(screen.getByRole('complementary'));

        expect(sidebar.getByText('Access control')).toBeInTheDocument();
        expect(sidebar.getByRole('link', { name: 'Roles' })).toHaveAttribute(
            'href',
            '/admin/access/roles',
        );
        expect(sidebar.getByRole('link', { name: 'Permission matrix' })).toBeInTheDocument();
        expect(sidebar.getByRole('link', { name: 'Temporary access' })).toBeInTheDocument();
    });

    it('names a custom role under the person, and hides access control without access.manage', () => {
        const queryClient = new QueryClient();
        queryClient.setQueryData(['me'], {
            ...admin,
            role: 'records_officer',
            role_name: 'Records officer',
            permissions: ['people.view'],
        });
        const router = createMemoryRouter(
            [
                {
                    path: '/admin',
                    element: <AdminLayout />,
                    children: [{ path: 'people', element: <p>People page</p> }],
                },
            ],
            { initialEntries: ['/admin/people'] },
        );
        render(
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>,
        );
        const sidebar = within(screen.getByRole('complementary'));

        expect(sidebar.getByText('Records officer')).toBeInTheDocument();
        expect(sidebar.queryByText('Access control')).toBeNull();
    });
});
