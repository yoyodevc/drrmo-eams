// M-Messages. One conversation with the DRRMO office, newest at the bottom, a text box and a Send
// button. Checks for answers every 60 seconds while open, and marks them read when they are on screen.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Conversation } from '../../components/Conversation';
import { POLL_MS, getMyConversation, markMyConversationRead, sendMessage } from '../../messages';

export function MyMessages() {
    const client = useQueryClient();
    const conversation = useQuery({
        queryKey: ['my-messages'],
        queryFn: getMyConversation,
        refetchInterval: POLL_MS,
    });
    const unread = conversation.data?.unread ?? 0;

    const markRead = useMutation({
        mutationFn: markMyConversationRead,
        onSuccess: () => {
            client.setQueryData(['my-messages-unread'], { unread: 0 });
            void client.invalidateQueries({ queryKey: ['my-messages'] });
        },
    });
    // Answers that are on screen count as read, including ones that arrive while the page is open.
    useEffect(() => {
        if (unread > 0 && !markRead.isPending) markRead.mutate();
        // markRead is a new object each render, so only the count decides.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unread]);

    async function send(body: string) {
        await sendMessage(body);
        await client.invalidateQueries({ queryKey: ['my-messages'] });
    }

    return (
        <div className="mx-auto flex h-[calc(100dvh-10rem)] max-w-2xl flex-col md:h-[calc(100dvh-9rem)]">
            <header>
                <h1 className="text-2xl font-bold tracking-tight text-stone-900">Messages</h1>
                <p className="mt-1 text-sm text-stone-600">
                    Write to the DRRMO office. Any of our staff can read and answer.
                </p>
            </header>

            {conversation.isPending && (
                <div aria-busy="true" className="mt-6 space-y-3">
                    <p role="status" className="sr-only">
                        Loading your messages...
                    </p>
                    <div className="h-12 w-3/5 animate-pulse rounded-card bg-stone-200" />
                    <div className="ml-auto h-12 w-2/5 animate-pulse rounded-card bg-stone-200" />
                </div>
            )}

            {conversation.isError && (
                <div className="mt-6 space-y-3">
                    <Alert tone="error">
                        Your messages did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        block
                        loading={conversation.isFetching}
                        onClick={() => void conversation.refetch()}
                    >
                        {conversation.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            )}

            {conversation.data && (
                <Conversation
                    messages={conversation.data.data}
                    mine={(m) => !m.from_office}
                    emptyText="No messages yet. Ask the office a question below."
                    placeholder="Write your message to DRRMO"
                    onSend={send}
                />
            )}
        </div>
    );
}
