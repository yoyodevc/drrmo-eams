// M-Messages. The list of conversations: the DRRMO office first, then people, newest first. A
// search box finds anyone in the system by name to start a new conversation. Checks for news every
// 60 seconds while open.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Alert } from '@/shared/ui/Alert';
import { POLL_MS, findPeople, getDirectChats, getMyConversation, listTime } from '../../messages';

const row =
    'flex min-h-16 items-center gap-3 border-b border-stone-100 px-4 py-3 hover:bg-stone-50';

function Badge({ n }: { n: number }) {
    return n > 0 ? (
        <span className="min-w-5 rounded-full bg-maroon-700 px-1.5 text-center text-xs font-semibold text-white">
            {n}
            <span className="sr-only"> unread</span>
        </span>
    ) : null;
}

export function MessagesHub() {
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

    const lastOffice = office.data?.data.at(-1);

    return (
        <div className="mx-auto max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Messages</h1>
            <p className="mt-1 text-sm text-stone-600">
                Write to the DRRMO office or to anyone in the system.
            </p>

            <form role="search" onSubmit={(e) => e.preventDefault()} className="mt-4">
                <label htmlFor="people-find" className="sr-only">
                    Find a person to message
                </label>
                <input
                    id="people-find"
                    type="search"
                    value={find}
                    onChange={(e) => setFind(e.target.value)}
                    placeholder="Find a person by name"
                    className="min-h-12 w-full rounded-control border border-stone-300 bg-white px-3 text-base"
                />
            </form>

            {term.length >= 2 ? (
                <div className="mt-4 rounded-card bg-white ring-1 ring-stone-200">
                    {people.isPending && (
                        <p role="status" className="p-4 text-sm text-stone-600">
                            Searching...
                        </p>
                    )}
                    {people.isError && (
                        <Alert tone="error">The search did not work. Try again.</Alert>
                    )}
                    {people.data?.data.length === 0 && (
                        <p className="p-4 text-sm text-stone-600">
                            No one matches &quot;{term}&quot;.
                        </p>
                    )}
                    <ul>
                        {people.data?.data.map((p) => (
                            <li key={p.id}>
                                <Link to={`/me/messages/with/${p.id}`} className={row}>
                                    <span className="truncate font-medium text-stone-900">
                                        {p.name}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <ul className="mt-4 rounded-card bg-white ring-1 ring-stone-200">
                    <li>
                        <Link to="/me/messages/office" className={row}>
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold text-stone-900">
                                    DRRMO office
                                </span>
                                <span className="block truncate text-sm text-stone-600">
                                    {lastOffice
                                        ? `${lastOffice.from_office ? '' : 'You: '}${lastOffice.body}`
                                        : 'Ask the office a question'}
                                </span>
                            </span>
                            <Badge n={office.data?.unread ?? 0} />
                        </Link>
                    </li>
                    {chats.data?.data.map((c) => (
                        <li key={c.person.id}>
                            <Link to={`/me/messages/with/${c.person.id}`} className={row}>
                                <span className="min-w-0 flex-1">
                                    <span
                                        className={`block truncate ${c.unread > 0 ? 'font-bold' : 'font-medium'} text-stone-900`}
                                    >
                                        {c.person.name}
                                    </span>
                                    <span className="block truncate text-sm text-stone-600">
                                        {c.last.mine ? 'You: ' : ''}
                                        {c.last.body}
                                    </span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end gap-1">
                                    <span className="text-xs text-stone-500">
                                        {listTime(c.last.sent_at)}
                                    </span>
                                    <Badge n={c.unread} />
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            {chats.isError && (
                <div className="mt-4">
                    <Alert tone="error">Your conversations did not load. Try again later.</Alert>
                </div>
            )}
        </div>
    );
}
