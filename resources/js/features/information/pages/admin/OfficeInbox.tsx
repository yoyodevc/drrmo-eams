// A-DRRMO inbox. Two panes on desktop: people with the newest activity first on the left, the
// conversation on the right. On a phone one pane shows at a time. Every admin sees the same inbox,
// so opening a conversation marks it read for all. Checks for news every 60 seconds.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Conversation } from '../../components/Conversation';
import {
    POLL_MS,
    getInbox,
    getInboxThread,
    listTime,
    markInboxThreadRead,
    replyTo,
    type InboxRow,
} from '../../messages';

function PersonRow({ row, active }: { row: InboxRow; active: boolean }) {
    return (
        <li>
            <Link
                to={`/admin/messages/${row.person.id}`}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 items-start gap-3 border-b border-stone-100 px-4 py-3 transition-colors ${active ? 'bg-maroon-50' : 'hover:bg-stone-50'}`}
            >
                <span className="min-w-0 flex-1">
                    <span
                        className={`block truncate text-sm ${row.unread > 0 ? 'font-bold text-stone-900' : 'font-medium text-stone-800'}`}
                    >
                        {row.person.name}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-stone-600">
                        {row.last.from_office ? 'You: ' : ''}
                        {row.last.body}
                    </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-stone-500">{listTime(row.last.sent_at)}</span>
                    {row.unread > 0 && (
                        <span className="min-w-5 rounded-full bg-maroon-700 px-1.5 text-center text-xs font-semibold text-white">
                            {row.unread}
                            <span className="sr-only"> unread</span>
                        </span>
                    )}
                </span>
            </Link>
        </li>
    );
}

function Thread({ personId }: { personId: number }) {
    const client = useQueryClient();
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
            <p role="status" className="p-6 text-sm text-stone-600">
                Loading the conversation...
            </p>
        );
    }
    if (thread.isError) {
        const missing = thread.error instanceof ApiError && thread.error.status === 404;
        return (
            <div className="space-y-3 p-6">
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

    return (
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 md:px-6">
            <header className="flex items-center gap-3 border-b border-stone-200 py-3">
                <Link
                    to="/admin/messages"
                    className="inline-flex min-h-10 items-center rounded-control px-2 text-sm font-semibold text-maroon-700 hover:bg-maroon-50 md:hidden"
                >
                    Inbox
                </Link>
                <h2 className="truncate text-lg font-semibold text-stone-900">
                    {thread.data.person.name}
                </h2>
            </header>
            <Conversation
                messages={thread.data.data}
                mine={(m) => m.from_office}
                showNames
                emptyText="No messages."
                placeholder={`Answer ${thread.data.person.name} on behalf of DRRMO`}
                sendLabel="Send answer"
                onSend={send}
            />
        </div>
    );
}

export function OfficeInbox() {
    const personId = Number(useParams().id) || null;
    const inbox = useQuery({ queryKey: ['inbox'], queryFn: getInbox, refetchInterval: POLL_MS });
    const [find, setFind] = useState('');
    const needle = find.trim().toLowerCase();
    const rows = (inbox.data?.data ?? []).filter(
        (r) => !needle || r.person.name.toLowerCase().includes(needle),
    );

    return (
        <div className="flex h-[calc(100dvh-9rem)] min-h-96 flex-col">
            <header className="mb-4">
                <h1 className="text-2xl font-bold tracking-tight text-stone-900">DRRMO inbox</h1>
                <p className="mt-1 text-sm text-stone-600">
                    Messages people send to the office. Every admin sees the same inbox.
                </p>
            </header>

            <div className="flex min-h-0 flex-1 overflow-hidden rounded-card border border-stone-200 bg-white">
                <aside
                    aria-label="Conversations"
                    className={`min-h-0 w-full shrink-0 overflow-y-auto border-stone-200 md:block md:w-80 md:border-r ${personId ? 'hidden' : 'block'}`}
                >
                    {inbox.isPending && (
                        <p role="status" className="p-4 text-sm text-stone-600">
                            Loading the inbox...
                        </p>
                    )}
                    {inbox.isError && (
                        <div className="space-y-3 p-4">
                            <Alert tone="error">The inbox did not load. Try again.</Alert>
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
                    {inbox.data && inbox.data.data.length === 0 && (
                        <p className="p-6 text-center text-sm text-stone-600">
                            No messages yet. When someone writes to DRRMO, it shows up here.
                        </p>
                    )}
                    {inbox.data && inbox.data.data.length > 0 && (
                        <div className="border-b border-stone-100 p-3">
                            <label htmlFor="inbox-find" className="sr-only">
                                Find a person
                            </label>
                            <input
                                id="inbox-find"
                                type="search"
                                value={find}
                                onChange={(e) => setFind(e.target.value)}
                                placeholder="Find a person"
                                className="min-h-10 w-full rounded-control border border-stone-300 px-3 text-sm"
                            />
                        </div>
                    )}
                    {inbox.data && inbox.data.data.length > 0 && rows.length === 0 && (
                        <p className="p-6 text-center text-sm text-stone-600">
                            No one matches &quot;{find.trim()}&quot;.
                        </p>
                    )}
                    {rows.length > 0 && (
                        <ul>
                            {rows.map((row) => (
                                <PersonRow
                                    key={row.person.id}
                                    row={row}
                                    active={row.person.id === personId}
                                />
                            ))}
                        </ul>
                    )}
                </aside>

                <section
                    aria-label="Conversation"
                    className={`min-h-0 min-w-0 flex-1 flex-col md:flex ${personId ? 'flex' : 'hidden'}`}
                >
                    {personId ? (
                        <Thread key={personId} personId={personId} />
                    ) : (
                        <p className="m-auto p-6 text-sm text-stone-600">
                            Pick a conversation to read it.
                        </p>
                    )}
                </section>
            </div>
        </div>
    );
}
