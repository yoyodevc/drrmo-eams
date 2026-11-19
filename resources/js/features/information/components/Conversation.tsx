// The messages of one conversation and the box to write the next one. Shared by the phone screen
// and the admin inbox, so both look and behave the same. Plain text only, no attachments in v1.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { MAX_MESSAGE, clockTime, groupByDay, type Message } from '../messages';

interface Props {
    messages: Message[];
    // Whose side is "mine": a person's own messages, or the office's answers for an admin.
    mine: (m: Message) => boolean;
    // Show the sender's name above a bubble (admins see which admin answered).
    showNames?: boolean;
    emptyText: string;
    placeholder: string;
    // Resolves when the message is saved. A rejection keeps the text and shows the error.
    onSend: (body: string) => Promise<void>;
    sendLabel?: string;
}

export function Conversation({
    messages,
    mine,
    showNames = false,
    emptyText,
    placeholder,
    onSend,
    sendLabel = 'Send',
}: Props) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const end = useRef<HTMLDivElement>(null);
    const count = messages.length;

    // Keep the newest message in view when the conversation opens and when one arrives.
    useEffect(() => {
        end.current?.scrollIntoView?.({ block: 'end' });
    }, [count]);

    const trimmed = text.trim();
    const over = text.length > MAX_MESSAGE;

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (trimmed === '' || over || sending) return;
        setSending(true);
        setError(null);
        try {
            await onSend(trimmed);
            setText('');
        } catch (e) {
            setError(
                e instanceof Error && e.message && !e.message.startsWith('API error')
                    ? e.message
                    : 'The message did not send. Check your connection and try again.',
            );
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1 py-4">
                {count === 0 && (
                    <p className="py-10 text-center text-sm text-stone-600">{emptyText}</p>
                )}
                {groupByDay(messages).map((group) => (
                    <section key={group.label} aria-label={group.label} className="space-y-2">
                        <p className="text-center text-xs font-medium text-stone-500">
                            {group.label}
                        </p>
                        {group.items.map((m) => {
                            const own = mine(m);
                            return (
                                <div
                                    key={m.id}
                                    className={`flex flex-col ${own ? 'items-end' : 'items-start'}`}
                                >
                                    {showNames && (
                                        <p className="mb-0.5 px-1 text-xs text-stone-600">
                                            {m.sender}
                                        </p>
                                    )}
                                    <p
                                        className={`max-w-[85%] rounded-card px-3.5 py-2.5 text-base break-words whitespace-pre-wrap ${own ? 'bg-maroon-700 text-white' : 'border border-stone-200 bg-white text-stone-900'}`}
                                    >
                                        {m.body}
                                    </p>
                                    <p className="mt-0.5 px-1 text-xs text-stone-500">
                                        {!showNames && <span>{own ? 'You' : m.sender} · </span>}
                                        {clockTime(m.sent_at)}
                                    </p>
                                </div>
                            );
                        })}
                    </section>
                ))}
                <div ref={end} />
            </div>

            <form
                onSubmit={(e) => void submit(e)}
                className="space-y-2 border-t border-stone-200 pt-3"
            >
                {error && <Alert tone="error">{error}</Alert>}
                <label htmlFor="message-text" className="sr-only">
                    Your message
                </label>
                <textarea
                    id="message-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    placeholder={placeholder}
                    aria-invalid={over}
                    aria-describedby="message-count"
                    className="block w-full resize-none rounded-control border border-stone-300 bg-white px-3.5 py-3 text-base text-stone-900 placeholder:text-stone-500 focus:border-maroon-700 focus:ring-2 focus:ring-maroon-700/30 focus:outline-none"
                />
                <div className="flex items-center justify-between gap-3">
                    <p
                        id="message-count"
                        className={`text-xs ${over ? 'font-semibold text-red-700' : 'text-stone-500'}`}
                    >
                        {text.length} of {MAX_MESSAGE}
                    </p>
                    <Button type="submit" loading={sending} disabled={trimmed === '' || over}>
                        {sending ? 'Sending...' : sendLabel}
                    </Button>
                </div>
            </form>
        </div>
    );
}
