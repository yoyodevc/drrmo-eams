// The messages of one conversation and the box to write the next one. Shared by the phone screen
// and the admin inbox, so both look and behave the same. Plain text only, no attachments in v1.
// Messages sit on the stone page color: the other side in white bubbles, your side in maroon.
// Messages from one sender within a few minutes form a run: tight spacing, and the name and time
// show once under the last one. Days are split by a hairline with the day's name.
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type FormEvent,
    type KeyboardEvent,
} from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { MAX_MESSAGE, clockTime, groupByDay, type Message } from '../messages';

type IconProps = { className?: string };

// A speech bubble, the same shape as the Messages tab icon.
export function ChatIcon({ className }: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M20.5 12a8 8 0 0 1-11.7 7.1L3.5 20.5l1.4-5A8 8 0 1 1 20.5 12Z" />
        </svg>
    );
}

// Messages closer than this, from the same sender, read as one run.
const RUN_MS = 5 * 60_000;
// The count under the box shows once the text gets this close to the limit.
const COUNT_FROM = MAX_MESSAGE - 200;
// The box grows with the text up to this height, then scrolls.
const MAX_BOX_PX = 160;

interface Props {
    messages: Message[];
    // Whose side is "mine": a person's own messages, or the office's answers for an admin.
    mine: (m: Message) => boolean;
    // Name the sender on your side too (admins see which admin answered). Otherwise it says "You".
    showNames?: boolean;
    emptyTitle?: string;
    emptyText: string;
    placeholder: string;
    // Resolves when the message is saved. A rejection keeps the text and shows the error.
    onSend: (body: string) => Promise<void>;
    sendLabel?: string;
    // Admin screens use the 40 px controls of a desktop toolbar.
    dense?: boolean;
    // Side padding for the list and the box, so the page can let them run edge to edge.
    inset?: string;
}

function sameRun(a: Message | undefined, b: Message | undefined): boolean {
    if (!a || !b) return false;
    return (
        a.from_office === b.from_office &&
        a.sender === b.sender &&
        Math.abs(new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()) <= RUN_MS
    );
}

function DayDivider({ label }: { label: string }) {
    return (
        <h3 className="flex items-center gap-3 py-1 text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase before:h-px before:flex-1 before:bg-stone-200 after:h-px after:flex-1 after:bg-stone-200">
            {label}
        </h3>
    );
}

export function Conversation({
    messages,
    mine,
    showNames = false,
    emptyTitle = 'No messages yet',
    emptyText,
    placeholder,
    onSend,
    sendLabel = 'Send',
    dense = false,
    inset = '',
}: Props) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scroller = useRef<HTMLDivElement>(null);
    const box = useRef<HTMLTextAreaElement>(null);
    const count = messages.length;

    // Keep the newest message in view when the conversation opens and when one arrives. Only the
    // message list scrolls, never the page around it.
    useEffect(() => {
        const el = scroller.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [count]);

    // The box grows with the text, from one line to about six, then scrolls inside.
    useLayoutEffect(() => {
        const el = box.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, MAX_BOX_PX)}px`;
    }, [text]);

    const trimmed = text.trim();
    const over = text.length > MAX_MESSAGE;
    const showCount = text.length >= COUNT_FROM;

    async function submit(event?: FormEvent) {
        event?.preventDefault();
        if (trimmed === '' || over || sending) return;
        setSending(true);
        setError(null);
        try {
            await onSend(trimmed);
            setText('');
            box.current?.focus();
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

    // Enter makes a new line, so a phone keyboard never sends by accident. Ctrl or Cmd + Enter sends.
    function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void submit();
        }
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div
                ref={scroller}
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 ${inset}`}
                aria-live="polite"
                aria-relevant="additions"
            >
                {count === 0 && (
                    <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
                        <span className="flex size-11 items-center justify-center rounded-control border border-stone-200 bg-white text-maroon-700">
                            <ChatIcon className="size-5" />
                        </span>
                        <p className="mt-4 text-lg font-semibold text-balance text-stone-900">
                            {emptyTitle}
                        </p>
                        <p className="mt-1 max-w-xs text-base text-pretty text-stone-600">
                            {emptyText}
                        </p>
                    </div>
                )}
                {groupByDay(messages).map((group) => (
                    <section key={group.label} aria-label={group.label} className="mt-4 first:mt-0">
                        <DayDivider label={group.label} />
                        <ol className="mt-3">
                            {group.items.map((m, i) => {
                                const own = mine(m);
                                const who = own && !showNames ? 'You' : m.sender;
                                const first = !sameRun(group.items[i - 1], m);
                                const last = !sameRun(m, group.items[i + 1]);
                                return (
                                    <li
                                        key={m.id}
                                        className={`flex flex-col ${own ? 'items-end pl-10' : 'items-start pr-10'} ${first ? 'mt-4 first:mt-0' : 'mt-1'}`}
                                    >
                                        <p
                                            className={`max-w-full rounded-card px-3.5 py-2.5 text-base break-words whitespace-pre-wrap sm:max-w-[34rem] ${own ? 'bg-maroon-700 text-white' : 'bg-white text-stone-900 ring-1 ring-stone-200'} ${last ? (own ? 'rounded-br-sm' : 'rounded-bl-sm') : ''}`}
                                        >
                                            <span className="sr-only">
                                                {who}, {clockTime(m.sent_at)}:{' '}
                                            </span>
                                            {m.body}
                                        </p>
                                        {last && (
                                            <p
                                                className="mt-1 px-1 text-xs text-stone-500 tabular-nums"
                                                aria-hidden="true"
                                            >
                                                {who === 'You' ? '' : `${who} · `}
                                                {clockTime(m.sent_at)}
                                            </p>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                ))}
            </div>

            <form
                onSubmit={(e) => void submit(e)}
                className={`border-t border-stone-200 bg-white py-3 ${inset}`}
            >
                {error && (
                    <div className="mb-3">
                        <Alert tone="error">{error}</Alert>
                    </div>
                )}
                <label htmlFor="message-text" className="sr-only">
                    Your message
                </label>
                <div className="flex items-end gap-2">
                    <textarea
                        ref={box}
                        id="message-text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={onKeyDown}
                        rows={1}
                        enterKeyHint="enter"
                        placeholder={placeholder}
                        aria-invalid={over || undefined}
                        aria-describedby="message-count"
                        className={`block w-full min-w-0 flex-1 resize-none rounded-control border bg-white px-3.5 text-base text-stone-900 transition-colors placeholder:text-stone-500 hover:border-stone-400 focus:ring-3 focus:outline-none ${dense ? 'min-h-10 py-2' : 'min-h-12 py-3'} ${over ? 'border-red-600 focus:border-red-700 focus:ring-red-700/15' : 'border-stone-300 focus:border-maroon-700 focus:ring-maroon-700/15'}`}
                    />
                    <Button
                        type="submit"
                        size={dense ? 'md' : 'lg'}
                        loading={sending}
                        disabled={trimmed === '' || over}
                        className="shrink-0"
                    >
                        {sending ? 'Sending...' : sendLabel}
                    </Button>
                </div>
                <p
                    id="message-count"
                    className={
                        showCount
                            ? `mt-1.5 text-sm tabular-nums ${over ? 'font-semibold text-red-700' : 'text-stone-600'}`
                            : 'sr-only'
                    }
                >
                    {showCount
                        ? `${text.length} of ${MAX_MESSAGE}${over ? '. Make it shorter to send.' : ''}`
                        : `Up to ${MAX_MESSAGE} characters.`}
                </p>
                {dense && !showCount && (
                    <p className="mt-1.5 hidden text-xs text-stone-500 lg:block" aria-hidden="true">
                        Ctrl + Enter sends.
                    </p>
                )}
            </form>
        </div>
    );
}
