// M-Messages. One messaging channel: the list of chats on the left and the open chat on the right.
// The DRRMO office is pinned on top, then person to person chats, newest first. The search finds
// anyone in the system by name to start a chat. On a phone the list and the chat take turns, and
// the screen fills the space between the top bar and the tab bar so only the messages scroll.
// From 768 px both sit side by side in one panel. Checks for news every 60 seconds while open.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import {
    ChatAvatar,
    ChatFrame,
    ChatRow,
    EmptyState,
    ListLabel,
    ListSkeleton,
    SearchField,
} from '../../components/chat';
import { POLL_MS, findPeople, getDirectChats, getMyConversation, listTime } from '../../messages';

const BASE = '/me/messages';

// Search people by name after a short pause, from 2 letters. Shared with the admin chats list.
export function usePeopleSearch() {
    const [find, setFind] = useState('');
    const [term, setTerm] = useState('');
    useEffect(() => {
        const t = setTimeout(() => setTerm(find.trim()), 300);
        return () => clearTimeout(t);
    }, [find]);
    const people = useQuery({
        queryKey: ['people', term],
        queryFn: () => findPeople(term),
        enabled: term.length >= 2,
    });
    return { find, setFind, term, people, searching: find.trim().length >= 2 };
}

// The search results: people to start a chat with, or to open the one you already have.
export function PeopleResults({
    search,
    base,
    activeId,
}: {
    search: ReturnType<typeof usePeopleSearch>;
    base: string;
    activeId: number | null;
}) {
    const { people, term } = search;
    if (people.isPending) return <ListSkeleton label="Searching..." />;
    if (people.isError) {
        return (
            <div className="p-4">
                <Alert tone="error">
                    The search did not work. Check your connection and try again.
                </Alert>
            </div>
        );
    }
    if (people.data.data.length === 0) {
        return (
            <EmptyState title={`No one matches "${term}"`}>
                <p className="mt-1 max-w-xs text-base text-pretty text-stone-600">
                    Check the spelling, or try a first or last name.
                </p>
            </EmptyState>
        );
    }
    return (
        <>
            <ListLabel>People</ListLabel>
            <ul className="divide-y divide-stone-100">
                {people.data.data.map((p) => (
                    <ChatRow
                        key={p.id}
                        to={`${base}/${p.id}`}
                        avatar={<ChatAvatar name={p.name} />}
                        name={p.name}
                        snippet="Send a message"
                        active={p.id === activeId}
                    />
                ))}
            </ul>
        </>
    );
}

function ChatList() {
    const { pathname } = useLocation();
    // The list sits above the chat's route, so it reads the open chat from the address.
    const activeId = Number(/\/with\/(\d+)/.exec(pathname)?.[1]) || null;
    const office = useQuery({
        queryKey: ['my-messages'],
        queryFn: getMyConversation,
        refetchInterval: POLL_MS,
    });
    const chats = useQuery({
        queryKey: ['direct-chats'],
        queryFn: getDirectChats,
        refetchInterval: POLL_MS,
    });
    const search = usePeopleSearch();
    const lastOffice = office.data?.data.at(-1);
    const rows = chats.data?.data ?? [];

    return (
        <>
            <div className="shrink-0 border-b border-stone-200 px-6 pt-5 pb-4 md:px-4">
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Messages</h1>
                <p className="mt-1 text-sm text-pretty text-stone-600">
                    Ask the DRRMO office, or chat with anyone on duty with you.
                </p>
                <div className="mt-4">
                    <SearchField
                        id="people-find"
                        label="Find a person to message"
                        value={search.find}
                        onChange={search.setFind}
                        placeholder="Search people by name"
                    />
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {search.searching ? (
                    <PeopleResults search={search} base={`${BASE}/with`} activeId={activeId} />
                ) : (
                    <>
                        <ListLabel>DRRMO office</ListLabel>
                        <ul>
                            <ChatRow
                                to={`${BASE}/office`}
                                avatar={<ChatAvatar office />}
                                name="ZPPSU DRRMO"
                                tag="Office"
                                time={lastOffice ? listTime(lastOffice.sent_at) : undefined}
                                mine={lastOffice ? !lastOffice.from_office : false}
                                snippet={
                                    lastOffice?.body ?? 'Ask about a duty, a memo or a schedule'
                                }
                                unread={office.data?.unread ?? 0}
                                active={pathname.startsWith(`${BASE}/office`)}
                            />
                        </ul>

                        <ListLabel>Direct messages</ListLabel>
                        {chats.isPending && <ListSkeleton />}
                        {chats.isError && (
                            <div className="space-y-3 px-4 pb-4">
                                <Alert tone="error">
                                    Your chats did not load. Check your connection and try again.
                                </Alert>
                                <Button
                                    variant="secondary"
                                    block
                                    loading={chats.isFetching}
                                    onClick={() => void chats.refetch()}
                                >
                                    {chats.isFetching ? 'Retrying...' : 'Retry'}
                                </Button>
                            </div>
                        )}
                        {chats.isSuccess && rows.length === 0 && (
                            <p className="px-4 pb-6 text-sm text-pretty text-stone-600">
                                No chats yet. Search for a name above to message a teammate.
                            </p>
                        )}
                        {rows.length > 0 && (
                            <ul className="divide-y divide-stone-100">
                                {rows.map((c) => (
                                    <ChatRow
                                        key={c.person.id}
                                        to={`${BASE}/with/${c.person.id}`}
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

// Shown on the right from 768 px while no chat is open.
export function PickChat() {
    return (
        <EmptyState title="Pick a chat">
            <p className="mt-1 max-w-xs text-base text-pretty text-stone-600">
                Open the DRRMO office or a teammate on the left, or search for someone to message.
            </p>
        </EmptyState>
    );
}

export function MessagesHub() {
    const { pathname } = useLocation();
    const open = pathname.replace(/\/+$/, '') !== BASE;

    return (
        // Fills the screen between the top bar and the tab bar. On phones it runs edge to edge.
        <div className="-mx-6 -mt-6 -mb-8 flex h-[calc(100dvh-8rem-env(safe-area-inset-bottom))] min-h-80 flex-col md:mx-0 md:mt-0 md:mb-0 md:h-[calc(100dvh-10.5rem)]">
            <ChatFrame open={open} list={<ChatList />} listLabel="Chats">
                <Outlet />
            </ChatFrame>
        </div>
    );
}
