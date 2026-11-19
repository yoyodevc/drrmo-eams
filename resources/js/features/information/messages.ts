// Typed calls and small helpers for Messages (S5.4): a person's conversation with the DRRMO
// office, and the shared DRRMO inbox for admins.
import { useQuery } from '@tanstack/react-query';
import { useMe } from '@/app/auth';
import { api } from '@/shared/api/client';

export interface Message {
    id: number;
    body: string;
    sent_at: string;
    // True when the office wrote it.
    from_office: boolean;
    // "You" or "DRRMO" for a person. The real names for an admin.
    sender: string;
}

export interface MyConversation {
    data: Message[];
    unread: number;
}

export interface InboxRow {
    person: { id: number; name: string };
    last: { body: string; sent_at: string; from_office: boolean };
    unread: number;
}

export interface Inbox {
    data: InboxRow[];
    unread: number;
}

export interface InboxThread {
    person: { id: number; name: string };
    data: Message[];
}

// The server limit, checked early so a long text is not lost on a slow connection.
export const MAX_MESSAGE = 1000;

// The Messages tab and the admin sidebar check for news this often while the app is open.
export const POLL_MS = 60_000;

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const getMyConversation = () => api<MyConversation>('/api/me/messages');

export async function sendMessage(body: string): Promise<Message> {
    return (await api<{ data: Message }>('/api/me/messages', json({ body }))).data;
}

export const markMyConversationRead = () =>
    api<{ unread: number }>('/api/me/messages/read', { method: 'POST' });

export const getInbox = () => api<Inbox>('/api/inbox');

export const getInboxThread = (personId: number) => api<InboxThread>(`/api/inbox/${personId}`);

export async function replyTo(personId: number, body: string): Promise<Message> {
    return (await api<{ data: Message }>(`/api/inbox/${personId}/reply`, json({ body }))).data;
}

export const markInboxThreadRead = (personId: number) =>
    api<{ unread: number }>(`/api/inbox/${personId}/read`, { method: 'POST' });

// Unread count for the Messages tab. Everyone has `messages.use`, so this always runs once signed in.
export function useMyUnreadMessages(): number {
    const userId = useMe().data?.id;
    const query = useQuery({
        queryKey: ['my-messages-unread'],
        queryFn: () => api<{ unread: number }>('/api/me/messages/unread'),
        enabled: userId !== undefined,
        refetchInterval: POLL_MS,
    });
    return query.data?.unread ?? 0;
}

// Unread count for the admin sidebar. Only asked for people who may open the inbox.
export function useInboxUnread(): number {
    const me = useMe().data;
    const allowed = me?.permissions.includes('messages.office_inbox') ?? false;
    const query = useQuery({
        queryKey: ['inbox-unread'],
        queryFn: () => api<{ unread: number }>('/api/inbox/unread'),
        enabled: allowed,
        refetchInterval: POLL_MS,
    });
    return allowed ? (query.data?.unread ?? 0) : 0;
}

const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dayName = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const dayYear = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

// "Today", "Yesterday", "Nov 12" or "Nov 12, 2025", for the line between days in a conversation.
export function dayLabel(iso: string, now: Date = new Date()): string {
    const date = new Date(iso);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (sameDay(date, now)) return 'Today';
    if (sameDay(date, yesterday)) return 'Yesterday';
    return (date.getFullYear() === now.getFullYear() ? dayName : dayYear).format(date);
}

// "3:05 PM" for today, otherwise the short date. For the inbox list.
export function listTime(iso: string, now: Date = new Date()): string {
    const date = new Date(iso);
    return sameDay(date, now) ? time.format(date) : dayLabel(iso, now);
}

export const clockTime = (iso: string) => time.format(new Date(iso));

// Groups a conversation by day, keeping the order it came in.
export function groupByDay(messages: Message[]): { label: string; items: Message[] }[] {
    const groups: { label: string; items: Message[] }[] = [];
    for (const m of messages) {
        const label = dayLabel(m.sent_at);
        const last = groups.at(-1);
        if (last?.label === label) last.items.push(m);
        else groups.push({ label, items: [m] });
    }
    return groups;
}
