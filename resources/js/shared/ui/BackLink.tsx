// A clear way back to the parent screen: an outlined button with an arrow and a plain label,
// for example "Back to memos". Sits above the page title. 40 px tall, so it is easy to hit.
import { Link } from 'react-router';

export function BackLink({ to, label }: { to: string; label: string }) {
    return (
        <Link
            to={to}
            className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-control border border-stone-500 bg-white pr-4 pl-3 text-sm font-semibold text-stone-800 transition-colors hover:border-maroon-700 hover:bg-maroon-50 hover:text-maroon-800 active:bg-maroon-100"
        >
            <svg
                viewBox="0 0 24 24"
                className="size-5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            <span className="truncate">{label}</span>
        </Link>
    );
}
