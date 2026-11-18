// M-Memos (S5.2). Search starts at 2 letters after a short pause. Category chips show how many
// memos each would find. Plain and functional; the visual design comes later.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { listMemos, memoFileUrl, postedOn } from '../../api';

const MIN_TERM = 2;
const DEBOUNCE_MS = 300;

export function MemoSearch() {
    const [text, setText] = useState('');
    const [term, setTerm] = useState('');
    const [category, setCategory] = useState('');

    useEffect(() => {
        const trimmed = text.trim();
        const next = trimmed.length >= MIN_TERM ? trimmed : '';
        const timer = setTimeout(() => setTerm(next), next === '' ? 0 : DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [text]);

    const memos = useQuery({
        queryKey: ['memos', 'search', term, category],
        queryFn: () => listMemos({ q: term, category }),
        placeholderData: keepPreviousData,
    });
    const rows = memos.data?.data ?? [];

    return (
        <div className="mx-auto max-w-2xl space-y-4 p-4">
            <h1 className="text-xl font-semibold text-stone-900">Memos</h1>
            <input
                type="search"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Search memos"
                aria-label="Search memos"
                className="block min-h-12 w-full rounded-control border border-stone-300 bg-white px-3 text-base focus:border-maroon-700 focus:outline-none"
            />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
                {[{ value: '', label: 'All', count: null as number | null }]
                    .concat(
                        (memos.data?.categories ?? []).map((c) => ({
                            value: c.value,
                            label: c.label,
                            count: c.count,
                        })),
                    )
                    .map((c) => (
                        <button
                            key={c.value}
                            type="button"
                            aria-pressed={category === c.value}
                            onClick={() => setCategory(c.value)}
                            className={`min-h-11 rounded-full px-4 text-sm font-semibold ring-1 ${
                                category === c.value
                                    ? 'bg-maroon-700 text-white ring-maroon-700'
                                    : 'bg-white text-stone-700 ring-stone-300'
                            }`}
                        >
                            {c.label}
                            {c.count !== null && ` (${c.count})`}
                        </button>
                    ))}
            </div>
            {memos.isError && <Alert tone="error">The memos did not load. Try again.</Alert>}
            {memos.isSuccess && rows.length === 0 && (
                <p className="text-stone-600">No memos match your search.</p>
            )}
            <ul className="space-y-3">
                {rows.map((m) => (
                    <li key={m.id} className="rounded-card bg-white p-4 ring-1 ring-stone-200">
                        <p className="text-sm font-semibold text-maroon-700">{m.category_label}</p>
                        <h2 className="text-lg font-semibold text-stone-900">{m.title}</h2>
                        <p className="text-sm text-stone-600">{postedOn(m.posted_at)}</p>
                        {m.file && (
                            <a
                                href={memoFileUrl(m.id)}
                                className="mt-2 inline-block text-sm font-semibold text-maroon-700 underline"
                            >
                                Open {m.file.name}
                            </a>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
