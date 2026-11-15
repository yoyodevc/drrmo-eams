// A row of mutually exclusive filter buttons with optional counts, for example "Active 3".
// Used when there are few enough options to show them all, so nothing hides behind a dropdown.
interface Option<T extends string> {
    id: T;
    label: string;
    // Left out while the numbers are still loading.
    count?: number;
}

export function SegmentedControl<T extends string>({
    label,
    options,
    value,
    onChange,
}: {
    label: string;
    options: Option<T>[];
    value: T;
    onChange: (id: T) => void;
}) {
    return (
        <div
            className="inline-flex flex-wrap gap-y-1 rounded-control bg-stone-100 p-1"
            aria-label={label}
            role="group"
        >
            {options.map((option) => {
                const selected = option.id === value;
                return (
                    <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onChange(option.id)}
                        className={`inline-flex min-h-9 items-center gap-2 rounded-[6px] px-3 text-sm font-semibold transition-colors ${selected ? 'bg-white text-stone-900 ring-1 ring-stone-200' : 'text-stone-600 hover:text-stone-900'}`}
                    >
                        {option.label}
                        {option.count !== undefined && (
                            <span
                                className={`text-xs tabular-nums ${selected ? 'text-stone-600' : 'text-stone-500'}`}
                            >
                                {option.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
