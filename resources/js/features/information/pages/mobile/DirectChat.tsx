// A chat with one other person. Shown on the right of the Messages list (on its own on phones), and
// in the admin Messages screen under My chats. Plain text, marked read while it is on screen. Checks
// for new messages every 60 seconds while open.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ChatAvatar, ChatHeader, ThreadSkeleton } from '../../components/chat';
import { Conversation } from '../../components/Conversation';
import { POLL_MS, getDirectChat, markDirectRead, sendDirect } from '../../messages';

// back: the list this chat belongs to, on the phone or in the admin area.
export function DirectChat({
    back = '/me/messages',
    dense = false,
}: {
    back?: string;
    dense?: boolean;
}) {
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

    if (chat.isPending) {
        return (
            <>
                <ChatHeader back={back} avatar={<ChatAvatar />} title="Loading..." />
                <ThreadSkeleton />
            </>
        );
    }

    if (chat.isError) {
        const missing = chat.error instanceof ApiError && chat.error.status === 404;
        return (
            <>
                <ChatHeader back={back} avatar={<ChatAvatar />} title="Chat" />
                <div className="space-y-3 p-4 md:p-6">
                    <Alert tone="error">
                        {missing
                            ? 'This person is not in the system.'
                            : 'The chat did not load. Check your connection and try again.'}
                    </Alert>
                    {!missing && (
                        <Button
                            variant="secondary"
                            block={!dense}
                            size={dense ? 'md' : 'lg'}
                            loading={chat.isFetching}
                            onClick={() => void chat.refetch()}
                        >
                            {chat.isFetching ? 'Retrying...' : 'Retry'}
                        </Button>
                    )}
                </div>
            </>
        );
    }

    const name = chat.data.person.name;
    return (
        <>
            <ChatHeader
                back={back}
                avatar={<ChatAvatar name={name} />}
                title={name}
                subtitle="Direct message. Only the two of you can read it."
            />
            <Conversation
                key={personId}
                messages={chat.data.data}
                mine={(m) => m.mine === true}
                theirAvatar={<ChatAvatar name={name} size="sm" />}
                emptyTitle={`Message ${name}`}
                emptyText="Only the two of you can read this chat. Keep it about your duties."
                placeholder={`Message ${name}`}
                dense={dense}
                inset="px-4 md:px-6"
                onSend={send}
            />
        </>
    );
}
