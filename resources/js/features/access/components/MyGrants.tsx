// "Extra access" on the Me page (S2.6). Shows the time-limited access the office gave this person
// and when it ends. Hidden when there is none, so most people never see it.
import { useQuery } from '@tanstack/react-query';
import { myGrants } from '@/features/access/api';
import { stamp } from '@/features/personnel/components/ui';

export function MyGrants() {
    const grants = useQuery({ queryKey: ['my-grants'], queryFn: myGrants });
    const current = grants.data?.filter((g) => g.status === 'active' || g.status === 'upcoming');

    if (!current || current.length === 0) return null;

    return (
        <section aria-labelledby="me-access" className="mt-8">
            <h2
                id="me-access"
                className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase"
            >
                Extra access
            </h2>
            <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                {current.map((g) => (
                    <li key={g.id} className="px-4 py-3">
                        <p className="font-semibold text-stone-900">{g.permission.label}</p>
                        <p className="text-sm text-pretty text-stone-600">
                            {g.permission.description}. {g.event ? `For ${g.event.title}. ` : ''}
                            {g.status === 'upcoming'
                                ? `Starts ${stamp(g.starts_at)}, ends ${stamp(g.ends_at)}.`
                                : `Until ${stamp(g.ends_at)}.`}
                        </p>
                        <p className="mt-0.5 text-sm text-pretty text-stone-500">{g.reason}</p>
                    </li>
                ))}
            </ul>
        </section>
    );
}
