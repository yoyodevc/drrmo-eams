// Month calendar for the personnel screens (My duties, Event notices). Mobile first at 360 px:
// a compact month with dots, and the chosen day's cards listed under it. From 768 px the month
// sits on the left and the cards on the right. It shows only what the screen already loaded,
// so each person still sees only their own duties or notices.
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import {
    dayKey,
    parseDayKey,
    rangeLabel,
    sameDay,
    shiftAnchor,
    startOfDay,
    touchesDay,
    visibleDays,
} from '@/features/events/calendar';
import { CalendarIcon, ChevronIcon, ListIcon } from '@/features/events/components/icons';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const longDay = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
});

interface Dated {
    id: string;
    starts_at: string;
    ends_at: string;
}

// List or Calendar, kept in the address bar as ?show=calendar.
export function useShowCalendar() {
    const [params] = useSearchParams();
    return params.get('show') === 'calendar';
}

export function ShowSwitch() {
    const [params, setParams] = useSearchParams();
    const calendar = params.get('show') === 'calendar';
    const options = [
        { id: 'list', label: 'List', icon: ListIcon },
        { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    ] as const;
    return (
        <div
            className="mt-5 flex rounded-control bg-stone-100 p-1 md:inline-flex"
            role="group"
            aria-label="Show as"
        >
            {options.map((option) => {
                const selected = (option.id === 'calendar') === calendar;
                const Icon = option.icon;
                return (
                    <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                            setParams(option.id === 'calendar' ? { show: 'calendar' } : {}, {
                                replace: true,
                            })
                        }
                        className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[6px] px-5 text-base font-semibold transition-colors md:min-h-10 md:flex-none md:text-sm ${selected ? 'bg-white text-stone-900 ring-1 ring-stone-200' : 'text-stone-600 hover:text-stone-900'}`}
                    >
                        <Icon className="size-5 md:size-4" />
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export function PersonalCalendar<T extends Dated>({
    items,
    noun,
    nouns,
    dotTone,
    renderDay,
}: {
    items: T[];
    // "duty" and "duties", for the counts and the empty line.
    noun: string;
    nouns: string;
    // Tailwind classes for one item's dot.
    dotTone: (item: T) => string;
    // The cards for the chosen day.
    renderDay: (items: T[]) => ReactNode;
}) {
    const [params, setParams] = useSearchParams();
    const today = startOfDay(new Date());
    const anchor = parseDayKey(params.get('date')) ?? today;
    const days = visibleDays('month', anchor);
    const pick = (day: Date) =>
        setParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                if (sameDay(day, today)) next.delete('date');
                else next.set('date', dayKey(day));
                return next;
            },
            { replace: true },
        );

    const plural = (count: number) => `${count} ${count === 1 ? noun : nouns}`;
    const inMonth = items.filter((item) =>
        days.some((day) => day.getMonth() === anchor.getMonth() && touchesDay(item, day)),
    );
    const onAnchor = items.filter((item) => touchesDay(item, anchor));
    const navButton =
        'flex size-12 items-center justify-center rounded-control text-stone-700 transition-colors hover:bg-stone-100 active:bg-stone-200 md:size-10';

    return (
        <div className="mt-6 md:grid md:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] md:items-start md:gap-6">
            <section
                aria-labelledby="month-label"
                className="rounded-card bg-white ring-1 ring-stone-200"
            >
                <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-2 py-1.5">
                    <button
                        type="button"
                        onClick={() => pick(shiftAnchor('month', anchor, -1))}
                        aria-label="Previous month"
                        className={navButton}
                    >
                        <ChevronIcon className="size-5 rotate-90" />
                    </button>
                    <div className="text-center">
                        <h2
                            id="month-label"
                            className="font-semibold text-stone-900"
                            aria-live="polite"
                        >
                            {rangeLabel('month', anchor)}
                        </h2>
                        <p className="text-sm text-stone-600 tabular-nums">
                            {inMonth.length ? plural(inMonth.length) : `No ${nouns}`}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => pick(shiftAnchor('month', anchor, 1))}
                        aria-label="Next month"
                        className={navButton}
                    >
                        <ChevronIcon className="size-5 -rotate-90" />
                    </button>
                </div>
                <div className="p-2">
                    <div className="grid grid-cols-7" aria-hidden="true">
                        {WEEKDAYS.map((name) => (
                            <div
                                key={name}
                                className="py-1 text-center text-xs font-semibold text-stone-500"
                            >
                                {name.slice(0, 1)}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {days.map((day) => {
                            const isToday = sameDay(day, today);
                            const picked = sameDay(day, anchor);
                            const muted = day.getMonth() !== anchor.getMonth();
                            const onDay = items.filter((item) => touchesDay(item, day));
                            return (
                                <button
                                    key={day.toISOString()}
                                    type="button"
                                    onClick={() => pick(day)}
                                    aria-pressed={picked}
                                    aria-current={isToday ? 'date' : undefined}
                                    aria-label={`${longDay.format(day)}, ${onDay.length ? plural(onDay.length) : `no ${nouns}`}`}
                                    className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-control"
                                >
                                    <span
                                        className={`flex size-8 items-center justify-center rounded-full text-sm transition-colors ${
                                            picked
                                                ? 'bg-maroon-700 font-semibold text-white'
                                                : isToday
                                                  ? 'font-bold text-maroon-700 ring-1 ring-maroon-700'
                                                  : muted
                                                    ? 'text-stone-500'
                                                    : 'text-stone-800'
                                        }`}
                                    >
                                        {day.getDate()}
                                    </span>
                                    <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                                        {onDay.slice(0, 3).map((item) => (
                                            <span
                                                key={item.id}
                                                className={`size-1.5 rounded-full ${dotTone(item)}`}
                                            />
                                        ))}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                {!sameDay(anchor, today) && (
                    <div className="border-t border-stone-200 px-2 py-1.5">
                        <button
                            type="button"
                            onClick={() => pick(today)}
                            className="min-h-12 w-full rounded-control text-base font-semibold text-maroon-700 transition-colors hover:bg-maroon-50 md:min-h-10 md:text-sm"
                        >
                            Back to today
                        </button>
                    </div>
                )}
            </section>

            <section aria-labelledby="day-label" className="mt-6 md:mt-0">
                <h2
                    id="day-label"
                    className="flex items-baseline gap-2 text-lg font-semibold text-stone-900"
                >
                    {longDay.format(anchor)}
                    {sameDay(anchor, today) && (
                        <span className="text-sm font-semibold text-maroon-700">Today</span>
                    )}
                </h2>
                {onAnchor.length === 0 ? (
                    <p className="mt-3 rounded-card bg-white px-4 py-4 text-base text-stone-600 ring-1 ring-stone-200">
                        No {nouns} on this day.
                    </p>
                ) : (
                    renderDay(onAnchor)
                )}
            </section>
        </div>
    );
}
