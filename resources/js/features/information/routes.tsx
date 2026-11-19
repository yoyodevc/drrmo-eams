import type { RouteObject } from 'react-router';
import { MemoEditor } from './pages/admin/MemoEditor';
import { MemoManager } from './pages/admin/MemoManager';
import { MemoView } from './pages/admin/MemoView';
import { OfficeInbox } from './pages/admin/OfficeInbox';
import { MemoRead } from './pages/mobile/MemoRead';
import { MemoSearch } from './pages/mobile/MemoSearch';
import { DirectChat } from './pages/mobile/DirectChat';
import { MessagesHub } from './pages/mobile/MessagesHub';
import { MyMessages } from './pages/mobile/MyMessages';

// Added to the admin layout in the Core router.
export const adminInformationRoutes: RouteObject[] = [
    { path: 'memos', element: <MemoManager /> },
    { path: 'memos/new', element: <MemoEditor /> },
    { path: 'memos/:id', element: <MemoView /> },
    { path: 'memos/:id/edit', element: <MemoEditor /> },
    { path: 'messages', element: <OfficeInbox /> },
    { path: 'messages/:id', element: <OfficeInbox /> },
];

// Added to the mobile layout in the Core router.
export const myInformationRoutes: RouteObject[] = [
    { path: 'memos', element: <MemoSearch /> },
    { path: 'memos/:id', element: <MemoRead /> },
    { path: 'messages', element: <MessagesHub /> },
    { path: 'messages/office', element: <MyMessages /> },
    { path: 'messages/with/:id', element: <DirectChat /> },
];
