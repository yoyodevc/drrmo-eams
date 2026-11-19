// M-Messages. One conversation with the DRRMO office, newest at the bottom, a text box and a Send
// button. Checks for answers every 60 seconds while open, and marks them read when they are on screen.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link } from 'react-router';
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
        // Fills the screen between the top bar and the tab bar, so only the messages scroll and the
        // box stays at thumb reach. On phones it runs edge to edge; from 768 px it sits in a panel.
        <div className="-mx-6 -mb-8 flex h-[calc(100dvh-9.5rem-env(safe-area-inset-bottom))] min-h-80 flex-col md:mx-auto md:mb-0 md:h-[calc(100dvh-10.5rem)] md:max-w-2xl">
            <header className="px-6 md:px-0">
                <Link
                    to="/me/messages"
                    className="inline-flex min-h-10 items-center text-sm font-semibold text-maroon-700 hover:underline"
                >
                    All messages
                </Link>
                <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                    DRRMO office
                </h1>
                <p className="mt-1 text-base text-pretty text-stone-600">
                    Questions for the DRRMO office. Any of our staff can answer.
                </p>
            </header>

            <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-stone-200 md:mt-6 md:overflow-hidden md:rounded-card md:border-t-0 md:ring-1 md:ring-stone-200">
                {conversation.isPending && (
                    <div aria-busy="true" className="flex-1 space-y-3 px-6 py-4">
                        <p role="status" className="sr-only">
                            Loading your messages...
                        </p>
                        <div
                            className="mx-auto h-3 w-16 animate-pulse rounded bg-stone-200"
                            aria-hidden="true"
                        />
                        <div
                            className="h-11 w-3/5 animate-pulse rounded-card bg-stone-200"
                            aria-hidden="true"
                        />
                        <div
                            className="ml-auto h-11 w-2/5 animate-pulse rounded-card bg-stone-200"
                            aria-hidden="true"
                        />
                        <div
                            className="h-16 w-4/5 animate-pulse rounded-card bg-stone-200"
                            aria-hidden="true"
                        />
                    </div>
                )}

                {conversation.isError && (
                    <div className="space-y-3 px-6 py-4">
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
                        emptyTitle="Ask DRRMO"
                        emptyText="Write about a duty, a memo or anything else. The answer shows up here, and the Messages tab tells you when it arrives."
                        placeholder="Write to DRRMO"
                        inset="px-6"
                        onSend={send}
                    />
                )}
            </div>
        </div>
    );
}
