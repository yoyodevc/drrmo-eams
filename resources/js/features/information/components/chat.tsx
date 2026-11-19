// The pieces every Messages screen shares, on the phone and in the admin area, so the DRRMO office
// chat, person to person chats and the office inbox read as one messaging channel: avatars, the
// two pane frame, list rows, the chat header, search, empty states and skeletons.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BackIcon, SearchIcon } from '@/features/personnel/components/ui';

type IconProps = { className?: string };

// A speech bubble, the same shape as the Messages tab icon.
export function ChatIcon({ className }: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M20.5 12a8 8 0 0 1-11.7 7.1L3.5 20.5l1.4-5A8 8 0 1 1 20.5 12Z" />
        </svg>
    );
}

// A paper plane, for the send button.
export function SendIcon({ className }: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z" />
        </svg>
    );
}

export function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/);
    const letters = `${parts[0]?.charAt(0) ?? ''}${parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? '') : ''}`;
    return letters.toUpperCase() || '?';
}

const avatarSizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-12 text-base' };

// A person's initials in a quiet stone circle, or the DRRMO seal for the office. Decorative: the
// name always sits next to it.
export function ChatAvatar({
    name,
    office = false,
    size = 'md',
}: {
    name?: string;
    office?: boolean;
    size?: keyof typeof avatarSizes;
}) {
    if (office) {
        return (
            <span
                aria-hidden="true"
                className={`flex shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-stone-200 ${avatarSizes[size]}`}
            >
                <img
                    src="/images/brand/drrmo-logo.webp"
                    alt=""
                    width={288}
                    height={320}
                    className="size-[78%] object-contain"
                />
            </span>
        );
    }
    return (
        <span
            aria-hidden="true"
            className={`flex shrink-0 items-center justify-center rounded-full bg-stone-100 font-semibold tracking-wide text-stone-700 ring-1 ring-stone-200 ring-inset ${avatarSizes[size]}`}
        >
            {initialsOf(name ?? '')}
        </span>
    );
}

// The list on the left and the open chat on the right. Below 768 px only one shows: the list, or
// the chat once one is open. From 768 px both sit in one white panel.
export function ChatFrame({
    open,
    list,
    listLabel,
    children,
}: {
    open: boolean;
    list: ReactNode;
    listLabel: string;
    children: ReactNode;
}) {
    return (
        <div className="flex min-h-0 flex-1 overflow-hidden bg-white md:rounded-card md:ring-1 md:ring-stone-200">
            <aside
                aria-label={listLabel}
                className={`min-h-0 w-full shrink-0 flex-col border-stone-200 md:flex md:w-80 md:border-r lg:w-96 ${open ? 'hidden' : 'flex'}`}
            >
                {list}
            </aside>
            <section
                aria-label="Conversation"
                className={`min-h-0 min-w-0 flex-1 flex-col bg-stone-50 md:flex ${open ? 'flex' : 'hidden'}`}
            >
                {children}
            </section>
        </div>
    );
}

// One conversation in a list: avatar, name, time, the last message and how many are unread.
export function ChatRow({
    to,
    avatar,
    name,
    tag,
    time,
    snippet,
    mine = false,
    unread = 0,
    active = false,
}: {
    to: string;
    avatar: ReactNode;
    name: string;
    tag?: string;
    time?: string;
    snippet: ReactNode;
    // The last message is yours, so it starts with "You:".
    mine?: boolean;
    unread?: number;
    active?: boolean;
}) {
    const fresh = unread > 0;
    return (
        <li>
            <Link
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-18 items-center gap-3 px-4 py-3 transition-colors ${active ? 'bg-maroon-50 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-maroon-700' : 'hover:bg-stone-50 active:bg-stone-100'}`}
            >
                {avatar}
                <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-baseline gap-2">
                            <span
                                className={`truncate ${fresh ? 'font-semibold text-stone-900' : 'font-medium text-stone-800'}`}
                            >
                                {name}
                            </span>
                            {tag && (
                                <span className="shrink-0 text-xs font-semibold tracking-[0.08em] text-maroon-700 uppercase">
                                    {tag}
                                </span>
                            )}
                        </span>
                        {time && (
                            <span
                                className={`shrink-0 text-xs tabular-nums ${fresh ? 'font-semibold text-maroon-700' : 'text-stone-500'}`}
                            >
                                {time}
                            </span>
                        )}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-3">
                        <span
                            className={`truncate text-sm ${fresh ? 'text-stone-800' : 'text-stone-600'}`}
                        >
                            {mine && <span className="text-stone-500">You: </span>}
                            {snippet}
                        </span>
                        {fresh && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-maroon-700 px-1.5 text-xs font-semibold text-white tabular-nums">
                                {unread > 99 ? '99+' : unread}
                                <span className="sr-only"> unread</span>
                            </span>
                        )}
                    </span>
                </span>
            </Link>
        </li>
    );
}

// The bar on top of an open chat: a way back on phones, who you are talking to, and an action.
export function ChatHeader({
    back,
    avatar,
    title,
    subtitle,
    action,
}: {
    back: string;
    avatar: ReactNode;
    title: string;
    subtitle?: string;
    action?: ReactNode;
}) {
    return (
        <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-stone-200 bg-white px-2 py-2 md:px-6">
            <Link
                to={back}
                className="flex size-12 shrink-0 items-center justify-center rounded-control text-maroon-700 transition-colors hover:bg-maroon-50 active:bg-maroon-100 md:hidden"
            >
                <BackIcon className="size-6" />
                <span className="sr-only">All messages</span>
            </Link>
            {avatar}
            <div className="min-w-0 flex-1">
                <h2 className="truncate text-base leading-tight font-semibold text-stone-900">
                    {title}
                </h2>
                {subtitle && (
                    <p className="mt-0.5 truncate text-sm leading-tight text-stone-600">
                        {subtitle}
                    </p>
                )}
            </div>
            {action}
        </header>
    );
}

// A search box with an icon and a clear button. 48 px on phones; `dense` makes it 40 px from 768 px.
export function SearchField({
    id,
    label,
    value,
    onChange,
    placeholder,
    dense = false,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    dense?: boolean;
}) {
    return (
        <form role="search" aria-label={label} onSubmit={(e) => e.preventDefault()}>
            <label htmlFor={id} className="sr-only">
                {label}
            </label>
            <span className="relative block">
                <SearchIcon
                    className={`pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-stone-500 ${dense ? 'md:left-3 md:size-4' : ''}`}
                />
                <input
                    id={id}
                    type="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={`block min-h-12 w-full rounded-control border border-stone-300 bg-stone-50 pr-12 pl-11 text-base text-stone-900 transition-colors placeholder:text-stone-500 hover:border-stone-400 focus:border-maroon-700 focus:bg-white focus:ring-3 focus:ring-maroon-700/15 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none ${dense ? 'md:min-h-10 md:pr-10 md:pl-9 md:text-sm' : ''}`}
                />
                {value !== '' && (
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className={`absolute top-0 right-0 flex size-12 items-center justify-center rounded-control text-stone-500 transition-colors hover:text-stone-900 active:bg-stone-100 ${dense ? 'md:size-10' : ''}`}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className="size-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <path d="M6 6l12 12M18 6 6 18" />
                        </svg>
                        <span className="sr-only">Clear search</span>
                    </button>
                )}
            </span>
        </form>
    );
}

// A small line icon in a hairline square, a title and one or two sentences.
export function EmptyState({
    title,
    children,
    icon,
}: {
    title: string;
    children?: ReactNode;
    icon?: ReactNode;
}) {
    return (
        <div className="m-auto flex flex-col items-center px-6 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-control border border-stone-200 bg-white text-maroon-700">
                {icon ?? <ChatIcon className="size-5" />}
            </span>
            <p className="mt-4 text-lg font-semibold text-balance text-stone-900">{title}</p>
            {children}
        </div>
    );
}

// An eyebrow over a part of the list, such as "Direct messages".
export function ListLabel({ children }: { children: ReactNode }) {
    return (
        <h3 className="px-4 pt-5 pb-2 text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">
            {children}
        </h3>
    );
}

export function ListSkeleton({ label = 'Loading your conversations...' }: { label?: string }) {
    return (
        <div aria-busy="true">
            <p role="status" className="sr-only">
                {label}
            </p>
            <ul aria-hidden="true">
                {[0, 1, 2, 3].map((row) => (
                    <li key={row} className="flex items-center gap-3 px-4 py-3">
                        <div className="size-10 shrink-0 animate-pulse rounded-full bg-stone-200" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-1/2 animate-pulse rounded bg-stone-200" />
                            <div className="h-3 w-4/5 animate-pulse rounded bg-stone-200" />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function ThreadSkeleton() {
    return (
        <div aria-busy="true" className="flex-1 space-y-3 px-4 py-6 md:px-6">
            <p role="status" className="sr-only">
                Loading the conversation...
            </p>
            <div
                className="mx-auto h-3 w-16 animate-pulse rounded bg-stone-200"
                aria-hidden="true"
            />
            <div className="flex items-end gap-2" aria-hidden="true">
                <div className="size-8 shrink-0 animate-pulse rounded-full bg-stone-200" />
                <div className="h-11 w-3/5 animate-pulse rounded-card bg-stone-200" />
            </div>
            <div
                className="ml-auto h-11 w-2/5 animate-pulse rounded-card bg-stone-200"
                aria-hidden="true"
            />
            <div className="flex items-end gap-2" aria-hidden="true">
                <div className="size-8 shrink-0 animate-pulse rounded-full bg-stone-200" />
                <div className="h-16 w-4/5 animate-pulse rounded-card bg-stone-200" />
            </div>
        </div>
    );
}
