// Shared pieces for the Reports tabs: the white panel with a header row, and the date format.
import type { ReactNode } from "react";

export const stamp = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// A white panel with a title row, the same shape as the People and Roles lists.
export function Panel({
  id,
  title,
  aside,
  children,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
    >
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-stone-200 px-4 md:px-5">
        <h2 id={id} className="text-base font-semibold text-stone-900">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export const linkClass =
  "inline-flex min-h-10 items-center rounded-sm text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline";
