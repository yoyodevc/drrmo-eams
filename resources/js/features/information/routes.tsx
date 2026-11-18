import type { RouteObject } from 'react-router';
import { MemoEditor } from './pages/admin/MemoEditor';
import { MemoManager } from './pages/admin/MemoManager';
import { MemoView } from './pages/admin/MemoView';
import { MemoRead } from './pages/mobile/MemoRead';
import { MemoSearch } from './pages/mobile/MemoSearch';

// Added to the admin layout in the Core router.
export const adminInformationRoutes: RouteObject[] = [
    { path: 'memos', element: <MemoManager /> },
    { path: 'memos/new', element: <MemoEditor /> },
    { path: 'memos/:id', element: <MemoView /> },
    { path: 'memos/:id/edit', element: <MemoEditor /> },
];

// Added to the mobile layout in the Core router.
export const myInformationRoutes: RouteObject[] = [
    { path: 'memos', element: <MemoSearch /> },
    { path: 'memos/:id', element: <MemoRead /> },
];
