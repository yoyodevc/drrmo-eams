// The three steps of the public "Request access" flow, shown under the title on each of its screens.
// Quiet on purpose: thin bars and small labels, no badges (DESIGN_SYSTEM.md section 1).
const steps = ['Your details', 'Confirm email', 'Approval'] as const;

export function RequestSteps({ current }: { current: 1 | 2 | 3 }) {
    return (
        <div className="mt-6">
            <p className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">
                Step {current} of {steps.length}
            </p>
            <ol className="mt-2.5 grid grid-cols-3 gap-2" aria-label="Steps to get an account">
                {steps.map((label, index) => {
                    const step = index + 1;
                    const done = step < current;
                    const now = step === current;
                    return (
                        <li key={label} aria-current={now ? 'step' : undefined}>
                            <span
                                aria-hidden="true"
                                className={`block h-1 rounded-full ${done || now ? 'bg-maroon-700' : 'bg-stone-200'}`}
                            />
                            <span
                                className={`mt-2 block text-[0.8125rem] leading-snug ${now ? 'font-semibold text-stone-900' : done ? 'text-stone-600' : 'text-stone-500'}`}
                            >
                                {label}
                                {done && <span className="sr-only"> (done)</span>}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
