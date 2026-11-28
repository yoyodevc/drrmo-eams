import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PersonalCalendar } from './PersonalCalendar';

const duty = {
    id: 'd1',
    title: 'Campus fun run',
    starts_at: new Date(2026, 10, 9, 8, 0).toISOString(),
    ends_at: new Date(2026, 10, 9, 17, 0).toISOString(),
};

function renderAt(date: string) {
    render(
        <MemoryRouter initialEntries={[`/me?show=calendar&date=${date}`]}>
            <PersonalCalendar
                items={[duty]}
                noun="duty"
                nouns="duties"
                dotTone={() => 'bg-maroon-700'}
                renderDay={(onDay) => (
                    <ul>
                        {onDay.map((item) => (
                            <li key={item.id}>{item.title}</li>
                        ))}
                    </ul>
                )}
            />
        </MemoryRouter>,
    );
}

describe('PersonalCalendar', () => {
    it('lists the chosen day and moves to another day on tap', () => {
        renderAt('2026-11-10');
        expect(screen.getByText('No duties on this day.')).toBeInTheDocument();
        expect(screen.getByText('1 duty')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /November 9, 1 duty/ }));
        expect(screen.getByText('Campus fun run')).toBeInTheDocument();
    });
});
