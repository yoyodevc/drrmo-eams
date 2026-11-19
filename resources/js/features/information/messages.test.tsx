import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from './components/Conversation';
import { MAX_MESSAGE, dayLabel, groupByDay, listTime, type Message } from './messages';

afterEach(cleanup);

const now = new Date(2026, 10, 19, 15, 0);

const msg = (id: number, sentAt: Date, fromOffice = false): Message => ({
    id,
    body: `Message ${id}`,
    sent_at: sentAt.toISOString(),
    from_office: fromOffice,
    sender: fromOffice ? 'DRRMO' : 'You',
});

describe('day labels', () => {
    it('names today and yesterday, then dates', () => {
        expect(dayLabel(new Date(2026, 10, 19, 8, 0).toISOString(), now)).toBe('Today');
        expect(dayLabel(new Date(2026, 10, 18, 23, 59).toISOString(), now)).toBe('Yesterday');
        expect(dayLabel(new Date(2026, 9, 2).toISOString(), now)).toMatch(/Oct\s+2$/);
        expect(dayLabel(new Date(2025, 9, 2).toISOString(), now)).toMatch(/2025/);
    });

    it('shows a time for today and a day for older messages in the list', () => {
        expect(listTime(new Date(2026, 10, 19, 9, 5).toISOString(), now)).toMatch(/9:05/);
        expect(listTime(new Date(2026, 10, 18, 9, 5).toISOString(), now)).toBe('Yesterday');
    });

    it('groups a conversation by day and keeps its order', () => {
        const groups = groupByDay([
            msg(1, new Date(2026, 10, 18, 9, 0)),
            msg(2, new Date(2026, 10, 18, 10, 0), true),
            msg(3, new Date(2026, 10, 19, 8, 0)),
        ]);
        expect(groups.map((g) => g.items.map((m) => m.id))).toEqual([[1, 2], [3]]);
    });
});

describe('Conversation', () => {
    const props = {
        messages: [msg(1, new Date()), msg(2, new Date(), true)],
        mine: (m: Message) => !m.from_office,
        emptyText: 'Nothing yet.',
        placeholder: 'Write here',
    };

    it('shows the messages, or a calm empty state', () => {
        const { rerender } = render(<Conversation {...props} onSend={vi.fn()} />);
        expect(screen.getByText('Message 1')).toBeInTheDocument();
        expect(screen.getByText('Message 2')).toBeInTheDocument();
        rerender(<Conversation {...props} messages={[]} onSend={vi.fn()} />);
        expect(screen.getByText('Nothing yet.')).toBeInTheDocument();
    });

    it('sends trimmed text, then clears the box', async () => {
        const onSend = vi.fn().mockResolvedValue(undefined);
        render(<Conversation {...props} onSend={onSend} />);
        const box = screen.getByLabelText('Your message');
        fireEvent.change(box, { target: { value: '  Where do I report?  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        await waitFor(() => expect(onSend).toHaveBeenCalledWith('Where do I report?'));
        await waitFor(() => expect(box).toHaveValue(''));
    });

    it('keeps the text and shows the error when sending fails', async () => {
        const onSend = vi.fn().mockRejectedValue(new Error('API error 500'));
        render(<Conversation {...props} onSend={onSend} />);
        const box = screen.getByLabelText('Your message');
        fireEvent.change(box, { target: { value: 'Please help' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('did not send');
        expect(box).toHaveValue('Please help');
    });

    it('blocks an empty or too long message', () => {
        render(<Conversation {...props} onSend={vi.fn()} />);
        const send = screen.getByRole('button', { name: 'Send' });
        expect(send).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '   ' } });
        expect(send).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Your message'), {
            target: { value: 'a'.repeat(MAX_MESSAGE + 1) },
        });
        expect(send).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Your message'), {
            target: { value: 'a'.repeat(MAX_MESSAGE) },
        });
        expect(send).toBeEnabled();
    });
});
