// A-Messages. The same two pane messaging screen people use on their phones, for the office. Two
// lists share the left pane: the DRRMO inbox (questions people send to the office, which every
// admin sees and any admin answers) and My chats (the admin's own person to person chats). The open
// chat sits on the right. Below 768 px one pane shows at a time. Opening an office conversation
// marks it read for every admin. Checks for news every 60 seconds.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useParams } from 'react-router';
import { useMe } from '@/app/auth';
import { ChevronIcon } from '@/features/personnel/components/ui';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import {
    ChatAvatar,
    ChatFrame,
    ChatHeader,
    ChatRow,
    EmptyState,
    ListSkeleton,
    SearchField,
    ThreadSkeleton,
} from '../../components/chat';
import { Conversation } from '../../components/Conversation';
import {
    POLL_MS,
    getDirectChats,
    getInbox,
    getInboxThread,
    listTime,
    markInboxThreadRead,
    replyTo,
} from '../../messages';
import { DirectChat } from '../mobile/DirectChat';
import { PeopleResults, usePeopleSearch } from '../mobile/MessagesHub';

const BASE = '/admin/messages';
const CHATS = `${BASE}/chats`;

const textLink =
    'inline-flex min-h-10 items-center gap-1 rounded-sm px-2 text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline';

function OfficeThread({ personId }: { personId: number }) {
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
                <ChatHeader back={BASE} avatar={<ChatAvatar />} title="Loading..." />
                <ThreadSkeleton />
            </>
        );
    }
    if (thread.isError) {
        const missing = thread.error instanceof ApiError && thread.error.status === 404;
        return (
            <>
                <ChatHeader back={BASE} avatar={<ChatAvatar />} title="Conversation" />
                <div className="space-y-3 p-4 md:p-6">
                    <Alert tone="error">
                        {missing
                            ? 'This person is not in the system.'
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
            </>
        );
    }

    const person = thread.data.person;
    return (
        <>
            <ChatHeader
                back={BASE}
                avatar={<ChatAvatar name={person.name} />}
                title={person.name}
                subtitle="Wrote to the DRRMO office. They see your answer from DRRMO."
                action={
                    canSeePeople && (
                        <Link to={`/admin/people/${person.id}`} className={`${textLink} shrink-0`}>
                            Profile
                            <ChevronIcon className="size-4" />
                        </Link>
                    )
                }
            />
            <Conversation
                key={personId}
                messages={thread.data.data}
                mine={(m) => m.from_office}
                showNames
                theirAvatar={<ChatAvatar name={person.name} size="sm" />}
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

// The two lists, as tabs over the left pane. Each shows how many messages wait.
function ListTabs({
    chats,
    officeUnread,
    chatsUnread,
}: {
    chats: boolean;
    officeUnread: number;
    chatsUnread: number;
}) {
    const tab = (to: string, label: string, n: number, active: boolean) => (
        <NavLink
            to={to}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[6px] px-3 text-sm font-semibold transition-colors ${active ? 'bg-white text-stone-900 ring-1 ring-stone-200' : 'text-stone-600 hover:text-stone-900'}`}
        >
            {label}
            {n > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-maroon-700 px-1.5 text-xs font-semibold text-white tabular-nums">
                    {n > 99 ? '99+' : n}
                    <span className="sr-only"> unread</span>
                </span>
            )}
        </NavLink>
    );
    return (
        <nav aria-label="Message lists" className="flex gap-1 rounded-control bg-stone-100 p-1">
            {tab(BASE, 'DRRMO inbox', officeUnread, !chats)}
            {tab(CHATS, 'My chats', chatsUnread, chats)}
        </nav>
    );
}

function Lists({ chats, activeId }: { chats: boolean; activeId: number | null }) {
    const inbox = useQuery({ queryKey: ['inbox'], queryFn: getInbox, refetchInterval: POLL_MS });
    const direct = useQuery({
        queryKey: ['direct-chats'],
        queryFn: getDirectChats,
        refetchInterval: POLL_MS,
    });
    const [find, setFind] = useState('');
    const people = usePeopleSearch();

    const needle = find.trim().toLowerCase();
    const officeRows = (inbox.data?.data ?? []).filter(
        (r) => !needle || r.person.name.toLowerCase().includes(needle),
    );
    const chatRows = direct.data?.data ?? [];
    const list = chats ? direct : inbox;
    const officeEmpty = inbox.isSuccess && inbox.data.data.length === 0;

    return (
        <>
            <div className="shrink-0 space-y-3 border-b border-stone-200 p-3">
                <ListTabs
                    chats={chats}
                    officeUnread={inbox.data?.unread ?? 0}
                    chatsUnread={direct.data?.unread ?? 0}
                />
                {chats ? (
                    <SearchField
                        id="chat-find"
                        label="Find a person to message"
                        value={people.find}
                        onChange={people.setFind}
                        placeholder="Search people to message"
                        dense
                    />
                ) : (
                    <SearchField
                        id="inbox-find"
                        label="Find a person"
                        value={find}
                        onChange={setFind}
                        placeholder="Find a person in the inbox"
                        dense
                    />
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {chats && people.searching ? (
                    <PeopleResults search={people} base={CHATS} activeId={activeId} />
                ) : (
                    <>
                        {list.isPending && <ListSkeleton />}
                        {list.isError && (
                            <div className="space-y-3 p-4">
                                <Alert tone="error">
                                    This list did not load. Check your connection and try again.
                                </Alert>
                                <Button
                                    variant="secondary"
                                    size="md"
                                    loading={list.isFetching}
                                    onClick={() => void list.refetch()}
                                >
                                    {list.isFetching ? 'Retrying...' : 'Retry'}
                                </Button>
                            </div>
                        )}

                        {!chats && officeEmpty && (
                            <EmptyState title="The inbox is empty">
                                <p className="mt-1 max-w-xs text-sm text-pretty text-stone-600">
                                    When someone writes to DRRMO, their message shows up here.
                                </p>
                            </EmptyState>
                        )}
                        {!chats && !officeEmpty && inbox.isSuccess && officeRows.length === 0 && (
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
                        )}
                        {!chats && officeRows.length > 0 && (
                            <ul className="divide-y divide-stone-100">
                                {officeRows.map((row) => (
                                    <ChatRow
                                        key={row.person.id}
                                        to={`${BASE}/${row.person.id}`}
                                        avatar={<ChatAvatar name={row.person.name} />}
                                        name={row.person.name}
                                        time={listTime(row.last.sent_at)}
                                        snippet={
                                            <>
                                                {row.last.from_office && (
                                                    <span className="text-stone-500">DRRMO: </span>
                                                )}
                                                {row.last.body}
                                            </>
                                        }
                                        unread={row.unread}
                                        active={row.person.id === activeId}
                                    />
                                ))}
                            </ul>
                        )}

                        {chats && direct.isSuccess && chatRows.length === 0 && (
                            <EmptyState title="No chats yet">
                                <p className="mt-1 max-w-xs text-sm text-pretty text-stone-600">
                                    Search for a name above to message anyone in the system.
                                </p>
                            </EmptyState>
                        )}
                        {chats && chatRows.length > 0 && (
                            <ul className="divide-y divide-stone-100">
                                {chatRows.map((c) => (
                                    <ChatRow
                                        key={c.person.id}
                                        to={`${CHATS}/${c.person.id}`}
                                        avatar={<ChatAvatar name={c.person.name} />}
                                        name={c.person.name}
                                        time={listTime(c.last.sent_at)}
                                        mine={c.last.mine}
                                        snippet={c.last.body}
                                        unread={c.unread}
                                        active={c.person.id === activeId}
                                    />
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </div>
        </>
    );
}

export function OfficeInbox() {
    const { pathname } = useLocation();
    const chats = pathname.startsWith(CHATS);
    const activeId = Number(useParams().id) || null;
    const inbox = useQuery({ queryKey: ['inbox'], queryFn: getInbox, refetchInterval: POLL_MS });
    const waiting = inbox.data?.unread ?? 0;

    return (
        // Fills the screen under the page title, so the list and the chat scroll on their own and
        // the answer box stays in view. On phones the panel runs edge to edge.
        <div className="mx-auto flex h-[calc(100dvh-5.5rem)] min-h-[32rem] max-w-[1440px] flex-col md:h-[calc(100dvh-3rem)] lg:h-[calc(100dvh-4rem)]">
            <header
                className={`mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 ${activeId ? 'max-md:hidden' : ''}`}
            >
                <div className="min-w-0">
                    <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                    <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                        Messages
                    </h1>
                    <p className="mt-1 max-w-xl text-pretty text-stone-600">
                        Answer what people ask the office, and chat with anyone in the system.
                    </p>
                </div>
                {inbox.isSuccess && (
                    <p className="text-sm text-stone-600 tabular-nums" aria-live="polite">
                        {waiting === 0
                            ? 'DRRMO inbox: all caught up'
                            : `DRRMO inbox: ${waiting} unread ${waiting === 1 ? 'message' : 'messages'}`}
                    </p>
                )}
            </header>

            <div className="flex min-h-0 flex-1 flex-col max-md:-mx-6 max-md:-mb-6">
                <ChatFrame
                    open={activeId !== null}
                    listLabel={chats ? 'My chats' : 'DRRMO inbox'}
                    list={<Lists chats={chats} activeId={activeId} />}
                >
                    {activeId === null ? (
                        <EmptyState title="Pick a conversation">
                            <p className="mt-1 max-w-xs text-base text-pretty text-stone-600">
                                {chats
                                    ? 'Open a chat on the left, or search for someone to message.'
                                    : 'Choose a person on the left to read their messages and answer for DRRMO.'}
                            </p>
                        </EmptyState>
                    ) : chats ? (
                        <DirectChat back={CHATS} dense />
                    ) : (
                        <OfficeThread key={activeId} personId={activeId} />
                    )}
                </ChatFrame>
            </div>
        </div>
    );
}
