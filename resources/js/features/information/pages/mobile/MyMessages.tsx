// M-Messages, the DRRMO office chat. Shown on the right of the Messages list (on its own on phones).
// Any admin can answer, and the person sees the answer from "DRRMO". Checks for answers every 60
// seconds while open, and marks them read when they are on screen.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ChatAvatar, ChatHeader, ThreadSkeleton } from '../../components/chat';
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
            void client.invalidateQueries({ queryKey: ['my-messages-unread'] });
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
        <>
            <ChatHeader
                back="/me/messages"
                avatar={<ChatAvatar office />}
                title="ZPPSU DRRMO"
                subtitle="Office chat. Any of our staff can answer."
            />

            {conversation.isPending && <ThreadSkeleton />}

            {conversation.isError && (
                <div className="space-y-3 p-4 md:p-6">
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
                    theirAvatar={<ChatAvatar office size="sm" />}
                    emptyTitle="Ask the DRRMO office"
                    emptyText="Our staff read every message and answer here. Pick a question to start, or write your own."
                    starters={[
                        'Where do I report for my duty?',
                        'I cannot make my assigned duty.',
                        'I have a question about a memo.',
                    ]}
                    placeholder="Message DRRMO"
                    inset="px-4 md:px-6"
                    onSend={send}
                />
            )}
        </>
    );
}
