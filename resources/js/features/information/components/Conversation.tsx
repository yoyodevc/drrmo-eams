// The messages of one conversation and the box to write the next one. Shared by every chat: the
// DRRMO office, person to person, and the admin inbox. Plain text only, no attachments in v1.
// Messages sit on the stone page color: the other side in white bubbles with their avatar, your side
// in maroon. Messages from one sender within a few minutes form a run: tight spacing, and the time
// shows once under the last one. Days are split by a hairline with the day's name. Your newest
// message says "Sent" or "Seen". A message shows at once while it is sending.
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type FormEvent,
    type KeyboardEvent,
    type ReactNode,
} from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Spinner } from '@/shared/ui/Spinner';
import { MAX_MESSAGE, clockTime, groupByDay, type Message } from '../messages';
import { ChatIcon, SendIcon } from './chat';

export { ChatIcon } from './chat';

// Messages closer than this, from the same sender, read as one run.
const RUN_MS = 5 * 60_000;
// The count under the box shows once the text gets this close to the limit.
const COUNT_FROM = MAX_MESSAGE - 200;
// The box grows with the text up to this height, then scrolls.
const MAX_BOX_PX = 160;
// The id of the message that is still on its way.
const PENDING_ID = -1;

interface Props {
    messages: Message[];
    // Whose side is "mine": your own messages, or the office's answers for an admin.
    mine: (m: Message) => boolean;
    // Name the sender on your side too (admins see which admin answered).
    showNames?: boolean;
    // The other side's avatar, shown next to the last bubble of each of their runs.
    theirAvatar?: ReactNode;
    emptyTitle?: string;
    emptyText: string;
    // Ready-made first messages for an empty chat. A tap puts one in the box to edit or send.
    starters?: string[];
    placeholder: string;
    // Resolves when the message is saved. A rejection puts the text back and shows the error.
    onSend: (body: string) => Promise<void>;
    sendLabel?: string;
    // Admin screens use the 40 px controls of a desktop toolbar.
    dense?: boolean;
    // Side padding for the list and the box, so the page can let them run edge to edge.
    inset?: string;
}

function sameRun(
    a: Message | undefined,
    b: Message | undefined,
    own: (m: Message) => boolean,
): boolean {
    if (!a || !b) return false;
    return (
        own(a) === own(b) &&
        (a.sender === b.sender || b.id === PENDING_ID) &&
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
    theirAvatar,
    emptyTitle = 'No messages yet',
    emptyText,
    starters = [],
    placeholder,
    onSend,
    sendLabel = 'Send',
    dense = false,
    inset = '',
}: Props) {
    const [text, setText] = useState('');
    const [pending, setPending] = useState<Message | null>(null);
    const [error, setError] = useState<string | null>(null);
    const scroller = useRef<HTMLDivElement>(null);
    const box = useRef<HTMLTextAreaElement>(null);

    const shown = pending ? [...messages, pending] : messages;
    const count = shown.length;
    const isMine = (m: Message) => m.id === PENDING_ID || mine(m);
    // The newest of your messages carries "Sent" or "Seen".
    const lastMineId = [...shown].reverse().find(isMine)?.id;

    // Keep the newest message in view when the chat opens and when one arrives. Only the message
    // list scrolls, never the page around it.
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
    const sending = pending !== null;

    async function submit(event?: FormEvent) {
        event?.preventDefault();
        if (trimmed === '' || over || sending) return;
        const body = trimmed;
        // Show it right away, like any messaging app, and clear the box for the next one.
        setPending({
            id: PENDING_ID,
            body,
            sent_at: new Date().toISOString(),
            from_office: false,
            sender: 'You',
        });
        setText('');
        setError(null);
        try {
            await onSend(body);
        } catch (e) {
            setText(body);
            setError(
                e instanceof Error && e.message && !e.message.startsWith('API error')
                    ? e.message
                    : 'The message did not send. Check your connection and try again.',
            );
        } finally {
            setPending(null);
            box.current?.focus();
        }
    }

    // Enter makes a new line, so a phone keyboard never sends by accident. Ctrl or Cmd + Enter sends.
    function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void submit();
        }
    }

    function start(starter: string) {
        setText(starter);
        box.current?.focus();
    }

    const gap = theirAvatar ? 'pr-6 sm:pr-16' : 'pr-10 sm:pr-16';

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div
                ref={scroller}
                className={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain py-4 ${inset}`}
                aria-live="polite"
                aria-relevant="additions"
            >
                {count === 0 && (
                    <div className="m-auto flex flex-col items-center px-2 py-8 text-center">
                        {theirAvatar ?? (
                            <span className="flex size-11 items-center justify-center rounded-control border border-stone-200 bg-white text-maroon-700">
                                <ChatIcon className="size-5" />
                            </span>
                        )}
                        <p className="mt-4 text-lg font-semibold text-balance text-stone-900">
                            {emptyTitle}
                        </p>
                        <p className="mt-1 max-w-xs text-base text-pretty text-stone-600">
                            {emptyText}
                        </p>
                        {starters.length > 0 && (
                            <ul className="mt-5 flex w-full max-w-sm flex-col gap-2">
                                {starters.map((s) => (
                                    <li key={s}>
                                        <button
                                            type="button"
                                            onClick={() => start(s)}
                                            className="flex min-h-12 w-full items-center gap-3 rounded-control border border-stone-200 bg-white px-4 py-2 text-left text-base text-stone-800 transition-colors hover:border-maroon-700/40 hover:bg-maroon-50 active:bg-maroon-100"
                                        >
                                            <ChatIcon className="size-4 shrink-0 text-maroon-700" />
                                            {s}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
                {/* A spacer pushes a short chat to the bottom, next to the box, like a messaging app. */}
                {count > 0 && <div className="flex-1" aria-hidden="true" />}
                {groupByDay(shown).map((group) => (
                    <section key={group.label} aria-label={group.label} className="mt-5 first:mt-0">
                        <DayDivider label={group.label} />
                        <ol className="mt-3">
                            {group.items.map((m, i) => {
                                const own = isMine(m);
                                const isPending = m.id === PENDING_ID;
                                const who = own && !showNames ? 'You' : m.sender;
                                const first = !sameRun(group.items[i - 1], m, isMine);
                                const last = !sameRun(m, group.items[i + 1], isMine);
                                const status = isPending
                                    ? 'Sending...'
                                    : own && m.id === lastMineId
                                      ? m.seen
                                          ? 'Seen'
                                          : 'Sent'
                                      : null;
                                const meta = [
                                    !own || showNames ? who : null,
                                    isPending ? null : clockTime(m.sent_at),
                                    status,
                                ].filter(Boolean);
                                return (
                                    <li
                                        key={m.id}
                                        className={`flex items-end gap-2 ${own ? 'justify-end pl-10 sm:pl-16' : gap} ${first ? 'mt-4 first:mt-0' : 'mt-1'}`}
                                    >
                                        {!own && theirAvatar && (
                                            <span
                                                className={`mb-5 w-8 shrink-0 ${last ? '' : 'invisible'}`}
                                            >
                                                {theirAvatar}
                                            </span>
                                        )}
                                        <div
                                            className={`flex min-w-0 flex-col ${own ? 'items-end' : 'items-start'}`}
                                        >
                                            <p
                                                className={`max-w-full rounded-card px-3.5 py-2.5 text-base break-words whitespace-pre-wrap sm:max-w-[34rem] ${own ? 'bg-maroon-700 text-white' : 'bg-white text-stone-900 ring-1 ring-stone-200'} ${last ? (own ? 'rounded-br-sm' : 'rounded-bl-sm') : ''} ${isPending ? 'opacity-70' : ''}`}
                                            >
                                                <span className="sr-only">
                                                    {who}
                                                    {isPending ? '' : `, ${clockTime(m.sent_at)}`}
                                                    :{' '}
                                                </span>
                                                {m.body}
                                            </p>
                                            {(last || status) && (
                                                <p
                                                    className={`mt-1 flex items-center gap-1.5 px-1 text-xs tabular-nums ${status === 'Seen' ? 'text-maroon-700' : 'text-stone-500'}`}
                                                >
                                                    {isPending && <Spinner />}
                                                    <span aria-hidden={status ? undefined : true}>
                                                        {meta.join(' · ')}
                                                    </span>
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                ))}
            </div>

            <form
                onSubmit={(e) => void submit(e)}
                className={`shrink-0 border-t border-stone-200 bg-white py-3 ${inset}`}
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
                        className={`block w-full min-w-0 flex-1 resize-none rounded-card border bg-stone-50 px-4 text-base text-stone-900 transition-colors placeholder:text-stone-500 hover:border-stone-400 focus:bg-white focus:ring-3 focus:outline-none ${dense ? 'min-h-10 py-2' : 'min-h-12 py-3'} ${over ? 'border-red-600 focus:border-red-700 focus:ring-red-700/15' : 'border-stone-300 focus:border-maroon-700 focus:ring-maroon-700/15'}`}
                    />
                    <button
                        type="submit"
                        aria-label={sendLabel}
                        title={sendLabel}
                        disabled={trimmed === '' || over || sending}
                        className={`flex shrink-0 items-center justify-center rounded-card bg-maroon-700 text-white transition-colors hover:bg-maroon-800 active:bg-maroon-900 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500 ${dense ? 'size-10' : 'size-12'}`}
                    >
                        <SendIcon className="size-5" />
                    </button>
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
                        : `Up to ${MAX_MESSAGE} characters. Ctrl + Enter sends.`}
                </p>
            </form>
        </div>
    );
}
