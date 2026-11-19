// A-DRRMO inbox. Two panes on desktop: people with the newest activity first on the left, the
// conversation on the right. Below 768 px one pane shows at a time, with a way back to the list.
// Every admin sees the same inbox, so opening a conversation marks it read for all. Checks for
// news every 60 seconds. Laid out like Memos: brand stripe and title, then one white panel.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useMe } from '@/app/auth';
import { BackIcon, ChevronIcon, SearchIcon } from '@/features/personnel/components/ui';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ChatIcon, Conversation } from '../../components/Conversation';
import {
    POLL_MS,
    getInbox,
    getInboxThread,
    listTime,
    markInboxThreadRead,
    replyTo,
    type InboxRow,
} from '../../messages';

const textLink =
    'inline-flex min-h-10 items-center gap-1 rounded-sm px-2 text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline';

// Same look as the search on People: 48 px on phones, 40 px from 768 px.
const searchControl =
    'block min-h-12 w-full rounded-control border border-stone-300 bg-white pr-3 pl-10 text-base text-stone-900 transition-colors placeholder:text-stone-500 hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none md:min-h-10 md:pl-9 md:text-sm';

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/);
    const letters = `${parts[0]?.charAt(0) ?? ''}${parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? '') : ''}`;
    return letters.toUpperCase() || '?';
}

// Initials in a quiet stone circle, like People. Decorative: the name always sits next to it.
function Initials({ name }: { name: string }) {
    return (
        <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold tracking-wide text-stone-700 ring-1 ring-stone-200 ring-inset"
        >
            {initialsOf(name)}
        </span>
    );
}

function EmptyState({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="m-auto flex flex-col items-center px-6 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-control border border-stone-200 bg-white text-maroon-700">
                <ChatIcon className="size-5" />
            </span>
            <p className="mt-4 text-lg font-semibold text-balance text-stone-900">{title}</p>
            <p className="mt-1 max-w-xs text-base text-pretty text-stone-600">{children}</p>
        </div>
    );
}

function PersonRow({ row, active }: { row: InboxRow; active: boolean }) {
    const fresh = row.unread > 0;
    return (
        <li>
            <Link
                to={`/admin/messages/${row.person.id}`}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-18 items-center gap-3 px-4 py-3 transition-colors ${active ? 'bg-maroon-50 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-maroon-700' : 'hover:bg-stone-50 active:bg-stone-100'}`}
            >
                <Initials name={row.person.name} />
                <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                        <span
                            className={`truncate ${fresh ? 'font-semibold text-stone-900' : 'font-medium text-stone-800'}`}
                        >
                            {row.person.name}
                        </span>
                        <span
                            className={`shrink-0 text-xs tabular-nums ${fresh ? 'font-semibold text-maroon-700' : 'text-stone-500'}`}
                        >
                            {listTime(row.last.sent_at)}
                        </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-3">
                        <span
                            className={`truncate text-sm ${fresh ? 'text-stone-800' : 'text-stone-600'}`}
                        >
                            {row.last.from_office && (
                                <span className="text-stone-500">DRRMO: </span>
                            )}
                            {row.last.body}
                        </span>
                        {fresh && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-maroon-700 px-1.5 text-xs font-semibold text-white tabular-nums">
                                {row.unread}
                                <span className="sr-only"> unread</span>
                            </span>
                        )}
                    </span>
                </span>
            </Link>
        </li>
    );
}

function ListSkeleton() {
    return (
        <div aria-busy="true">
            <p role="status" className="sr-only">
                Loading the inbox...
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

function ThreadSkeleton() {
    return (
        <div aria-busy="true" className="flex-1 space-y-3 p-6">
            <p role="status" className="sr-only">
                Loading the conversation...
            </p>
            <div
                className="mx-auto h-3 w-16 animate-pulse rounded bg-stone-200"
                aria-hidden="true"
            />
            <div
                className="h-11 w-2/5 animate-pulse rounded-card bg-stone-200"
                aria-hidden="true"
            />
            <div
                className="ml-auto h-16 w-1/2 animate-pulse rounded-card bg-stone-200"
                aria-hidden="true"
            />
        </div>
    );
}

// The way back to the list, only while one pane shows at a time.
function BackToInbox() {
    return (
        <Link
            to="/admin/messages"
            className="-ml-2 inline-flex min-h-12 shrink-0 items-center gap-1 rounded-control pr-2 pl-1 text-sm font-semibold text-maroon-700 hover:bg-maroon-50 md:hidden"
        >
            <BackIcon className="size-5" />
            Inbox
        </Link>
    );
}

function Thread({ personId }: { personId: number }) {
    const client = useQueryClient();
    const me = useMe().data;
    const canSeePeople = me?.permissions.includes('people.view') ?? false;
    const thread = useQuery({
        queryKey: ['inbox-thread', personId],
        queryFn: () => getInboxThread(personId),
        refetchInterval: POLL_MS,
    });
    // How many of this person's messages are still unread, as the inbox list knows it.
    const unread = useQuery({
        queryKey: ['inbox'],
        queryFn: getInbox,
        refetchInterval: POLL_MS,
    }).data?.data.find((r) => r.person.id === personId)?.unread;

    const markRead = useMutation({
        mutationFn: () => markInboxThreadRead(personId),
        onSuccess: () => {
            void client.invalidateQueries({ queryKey: ['inbox'] });
            void client.invalidateQueries({ queryKey: ['inbox-unread'] });
        },
    });
    useEffect(() => {
        if (unread && unread > 0 && !markRead.isPending) markRead.mutate();
        // markRead is a new object each render, so only the count and the person decide.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unread, personId]);

    async function send(body: string) {
        await replyTo(personId, body);
        await Promise.all([
            client.invalidateQueries({ queryKey: ['inbox-thread', personId] }),
            client.invalidateQueries({ queryKey: ['inbox'] }),
        ]);
    }

    if (thread.isPending) {
        return (
            <>
                <div className="flex min-h-16 items-center border-b border-stone-200 bg-white px-4 md:hidden">
                    <BackToInbox />
                </div>
                <ThreadSkeleton />
            </>
        );
    }
    if (thread.isError) {
        const missing = thread.error instanceof ApiError && thread.error.status === 404;
        return (
            <div className="space-y-3 p-4 md:p-6">
                <BackToInbox />
                <Alert tone="error">
                    {missing
                        ? 'This person does not exist.'
                        : 'The conversation did not load. Check your connection and try again.'}
                </Alert>
                {!missing && (
                    <Button
                        variant="secondary"
                        size="md"
                        loading={thread.isFetching}
                        onClick={() => void thread.refetch()}
                    >
                        {thread.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                )}
            </div>
        );
    }

    const person = thread.data.person;
    return (
        <>
            <header className="flex min-h-16 items-center gap-3 border-b border-stone-200 bg-white px-4 py-2 md:px-6">
                <BackToInbox />
                <span className="max-md:hidden">
                    <Initials name={person.name} />
                </span>
                <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-stone-900">
                    {person.name}
                </h2>
                {canSeePeople && (
                    <Link to={`/admin/people/${person.id}`} className={`${textLink} shrink-0`}>
                        Profile
                        <ChevronIcon className="size-4" />
                    </Link>
                )}
            </header>
            <Conversation
                messages={thread.data.data}
                mine={(m) => m.from_office}
                showNames
                emptyTitle="No messages yet"
                emptyText={`${person.name} has not written to DRRMO yet.`}
                placeholder={`Answer ${person.name} for DRRMO`}
                sendLabel="Send answer"
                dense
                inset="px-4 md:px-6"
                onSend={send}
            />
        </>
    );
}

export function OfficeInbox() {
    const personId = Number(useParams().id) || null;
    const inbox = useQuery({ queryKey: ['inbox'], queryFn: getInbox, refetchInterval: POLL_MS });
    const [find, setFind] = useState('');
    const needle = find.trim().toLowerCase();
    const all = inbox.data?.data ?? [];
    const rows = all.filter((r) => !needle || r.person.name.toLowerCase().includes(needle));
    const empty = inbox.isSuccess && all.length === 0 && personId === null;
    const unread = inbox.data?.unread ?? 0;

    return (
        // Fills the screen under the page title, so the list and the conversation scroll on their
        // own and the answer box stays in view.
        <div className="mx-auto flex h-[calc(100dvh-7rem)] min-h-[32rem] max-w-[1440px] flex-col md:h-[calc(100dvh-3rem)] lg:h-[calc(100dvh-4rem)]">
            <header
                className={`mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 ${personId ? 'max-md:hidden' : ''}`}
            >
                <div className="min-w-0">
                    <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                        DRRMO inbox
                    </h1>
                    <p className="mt-1 max-w-xl text-pretty text-stone-600">
                        Questions people send to the office. Every admin sees the same inbox, and
                        any of you can answer.
                    </p>
                </div>
                {inbox.isSuccess && (
                    <p className="text-sm text-stone-600 tabular-nums" aria-live="polite">
                        {unread === 0
                            ? 'All caught up'
                            : unread === 1
                              ? '1 unread message'
                              : `${unread} unread messages`}
                    </p>
                )}
            </header>

            <div className="flex min-h-0 flex-1 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                {empty ? (
                    <EmptyState title="No messages yet">
                        When someone writes to DRRMO, their message shows up here.
                    </EmptyState>
                ) : (
                    <>
                        <aside
                            aria-label="Conversations"
                            className={`min-h-0 w-full shrink-0 flex-col border-stone-200 md:flex md:w-80 md:border-r lg:w-96 ${personId ? 'hidden' : 'flex'}`}
                        >
                            {inbox.isPending && <ListSkeleton />}
                            {inbox.isError && (
                                <div className="space-y-3 p-4">
                                    <Alert tone="error">
                                        The inbox did not load. Check your connection and try again.
                                    </Alert>
                                    <Button
                                        variant="secondary"
                                        size="md"
                                        loading={inbox.isFetching}
                                        onClick={() => void inbox.refetch()}
                                    >
                                        {inbox.isFetching ? 'Retrying...' : 'Retry'}
                                    </Button>
                                </div>
                            )}
                            {all.length > 0 && (
                                <>
                                    <form
                                        role="search"
                                        aria-label="Find a person"
                                        onSubmit={(e) => e.preventDefault()}
                                        className="border-b border-stone-200 p-3"
                                    >
                                        <label htmlFor="inbox-find" className="sr-only">
                                            Find a person
                                        </label>
                                        <span className="relative block">
                                            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-stone-500 md:size-4" />
                                            <input
                                                id="inbox-find"
                                                type="search"
                                                autoComplete="off"
                                                value={find}
                                                onChange={(e) => setFind(e.target.value)}
                                                placeholder="Find a person"
                                                className={searchControl}
                                            />
                                        </span>
                                    </form>
                                    {rows.length === 0 ? (
                                        <div className="px-4 py-8 text-center">
                                            <p className="text-sm text-pretty text-stone-600">
                                                No one matches &quot;{find.trim()}&quot;.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => setFind('')}
                                                className={`${textLink} mt-1`}
                                            >
                                                Clear search
                                            </button>
                                        </div>
                                    ) : (
                                        <ul className="min-h-0 flex-1 divide-y divide-stone-100 overflow-y-auto">
                                            {rows.map((row) => (
                                                <PersonRow
                                                    key={row.person.id}
                                                    row={row}
                                                    active={row.person.id === personId}
                                                />
                                            ))}
                                        </ul>
                                    )}
                                </>
                            )}
                        </aside>

                        <section
                            aria-label="Conversation"
                            className={`min-h-0 min-w-0 flex-1 flex-col bg-stone-50 md:flex ${personId ? 'flex' : 'hidden'}`}
                        >
                            {personId ? (
                                <Thread key={personId} personId={personId} />
                            ) : (
                                <EmptyState title="Pick a conversation">
                                    Choose a person on the left to read their messages and answer
                                    for DRRMO.
                                </EmptyState>
                            )}
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
