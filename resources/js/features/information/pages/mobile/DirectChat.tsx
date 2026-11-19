// A conversation with one other person. Plain text, marked read while it is on screen. Checks for
// new messages every 60 seconds while open.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Conversation } from '../../components/Conversation';
import { POLL_MS, getDirectChat, markDirectRead, sendDirect } from '../../messages';

export function DirectChat() {
    const personId = Number(useParams().id) || 0;
    const client = useQueryClient();
    const chat = useQuery({
        queryKey: ['direct-chat', personId],
        queryFn: () => getDirectChat(personId),
        refetchInterval: POLL_MS,
        enabled: personId > 0,
    });
    const lastId = chat.data?.data.at(-1)?.id;
    const hasTheirs = chat.data?.data.some((m) => !m.mine) ?? false;

    const markRead = useMutation({
        mutationFn: () => markDirectRead(personId),
        onSuccess: () => {
            void client.invalidateQueries({ queryKey: ['my-messages-unread'] });
            void client.invalidateQueries({ queryKey: ['direct-chats'] });
        },
    });
    // Whatever is on screen counts as read, including messages that arrive while the page is open.
    useEffect(() => {
        if (hasTheirs) markRead.mutate();
        // markRead is a new object each render, so only the newest message decides.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastId, personId]);

    async function send(body: string) {
        await sendDirect(personId, body);
        await Promise.all([
            client.invalidateQueries({ queryKey: ['direct-chat', personId] }),
            client.invalidateQueries({ queryKey: ['direct-chats'] }),
        ]);
    }

    return (
        <div className="mx-auto flex h-[calc(100dvh-10rem)] max-w-2xl flex-col md:h-[calc(100dvh-9rem)]">
            <header>
                <Link
                    to="/me/messages"
                    className="inline-flex min-h-10 items-center text-sm font-semibold text-maroon-700 hover:underline"
                >
                    All messages
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                    {chat.data?.person.name ?? 'Message'}
                </h1>
            </header>

            {chat.isPending && (
                <p role="status" className="mt-6 text-sm text-stone-600">
                    Loading the conversation...
                </p>
            )}
            {chat.isError && (
                <div className="mt-6 space-y-3">
                    <Alert tone="error">
                        The conversation did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        block
                        loading={chat.isFetching}
                        onClick={() => void chat.refetch()}
                    >
                        {chat.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            )}
            {chat.data && (
                <Conversation
                    messages={chat.data.data}
                    mine={(m) => m.mine === true}
                    emptyText={`No messages yet. Say hello to ${chat.data.person.name}.`}
                    placeholder={`Write to ${chat.data.person.name}`}
                    onSend={send}
                />
            )}
        </div>
    );
}
