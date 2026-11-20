// A-Reports, Report feed tab (S4.8). Site reports, newest first, with filters by event, place and date.
// Desktop first. Filters sit in the URL so a view can be shared. A photo opens in a lightbox.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Alert } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import { stamp } from "../../components/reportsUi";
import {
  getReportFeed,
  reportPhotoUrl,
  type FeedFilters,
  type FeedReport,
} from "../../api";

const control =
  "block min-h-12 w-full rounded-control border border-stone-300 bg-white px-3 text-base text-stone-900 transition-colors hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none md:min-h-10 md:text-sm";
const labelClass = "block min-w-0 text-sm font-medium text-stone-800";

function Chevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-stone-500 md:size-4"
    >
      <path d="M5 8l5 5 5-5" />
    </svg>
  );
}

function Select({
  name,
  value,
  onChange,
  className = "",
  children,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`${labelClass} ${className}`}>
      <span className="mb-1.5 block">{name}</span>
      <span className="relative block">
        <select
          className={`${control} cursor-pointer appearance-none pr-10`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {children}
        </select>
        <Chevron />
      </span>
    </label>
  );
}

const badges: Record<string, { label: string; chip: string } | undefined> = {
  late: { label: "Late", chip: "bg-amber-50 text-amber-900 ring-amber-200" },
  overdue: {
    label: "Overdue",
    chip: "bg-ember-50 text-ember-700 ring-ember-200",
  },
  missed: { label: "Missed", chip: "bg-red-100 text-red-900 ring-red-300" },
};

function Lightbox({
  report,
  onClose,
}: {
  report: FeedReport | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (report && !el.open) el.showModal();
    if (!report && el.open) el.close();
  }, [report]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      aria-label="Report photo"
      className="m-auto max-h-[90dvh] max-w-[90vw] rounded-card bg-white p-3 backdrop:bg-black/70"
    >
      {report && (
        <div>
          <img
            src={reportPhotoUrl(report.id)}
            alt={`Photo from ${report.author ?? "the reporter"} at ${report.event.title ?? "the event"}`}
            className="max-h-[75dvh] max-w-full rounded-control object-contain"
          />
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}

function ReportRow({
  report,
  onPhoto,
}: {
  report: FeedReport;
  onPhoto: () => void;
}) {
  const badge = badges[report.status];

  return (
    <li
      className={`relative px-4 py-4 md:px-5 ${report.status === "missed" ? "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-red-700" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-semibold text-stone-900">{report.event.title}</p>
        {badge && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.chip}`}
          >
            {badge.label}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-sm text-stone-600">
        {report.author ?? "Unknown"} · {report.location ?? "No place"} · due{" "}
        <span className="tabular-nums">
          {stamp.format(new Date(report.due_at))}
        </span>
        {report.submitted_at && (
          <>
            , sent{" "}
            <span className="tabular-nums">
              {stamp.format(new Date(report.submitted_at))}
            </span>
          </>
        )}
      </p>
      <div className="mt-3 flex gap-4">
        <p className="max-w-3xl min-w-0 flex-1 text-base text-pretty whitespace-pre-wrap text-stone-800">
          {report.summary ?? (
            <span className="text-stone-500">
              No report was sent for this slot.
            </span>
          )}
        </p>
        {report.has_photo && (
          <button
            type="button"
            onClick={onPhoto}
            className="shrink-0 self-start overflow-hidden rounded-control ring-1 ring-stone-300 focus:ring-2 focus:ring-maroon-700 focus:outline-none"
            aria-label="Open photo"
          >
            <img
              src={reportPhotoUrl(report.id)}
              alt=""
              loading="lazy"
              className="size-20 object-cover md:size-24"
            />
          </button>
        )}
      </div>
    </li>
  );
}

export function ReportFeed() {
  const [params, setParams] = useSearchParams();
  const filters: FeedFilters = {
    event_id: params.get("event_id") ?? "",
    location_id: params.get("location_id") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [photoOf, setPhotoOf] = useState<FeedReport | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const feed = useQuery({
    queryKey: ["report-feed", filters, page],
    queryFn: () => getReportFeed(filters, page),
    placeholderData: keepPreviousData,
  });

  function change(key: keyof FeedFilters, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next, { replace: true });
  }

  function goTo(target: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(target));
    setParams(next);
  }

  function clear() {
    setParams(new URLSearchParams(), { replace: true });
  }

  const rows = feed.data?.data ?? [];
  const lastPage = feed.data?.meta.last_page ?? 1;
  const total = feed.data?.meta.total ?? 0;
  const active = Object.values(filters).filter(Boolean).length;

  return (
    <div>
      <form
        role="search"
        aria-label="Filter reports"
        onSubmit={(e) => e.preventDefault()}
        className=""
      >
        <button
          type="button"
          aria-expanded={showFilters}
          aria-controls="feed-filters"
          onClick={() => setShowFilters((v) => !v)}
          className={`inline-flex min-h-12 w-full items-center justify-between gap-2 rounded-control border px-4 text-base font-semibold transition-colors md:hidden ${showFilters || active > 0 ? "border-maroon-700 bg-maroon-50 text-maroon-800" : "border-stone-300 bg-white text-stone-800 hover:bg-stone-50"}`}
        >
          <span>Filters{active > 0 ? ` (${active} on)` : ""}</span>
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`size-5 transition-transform ${showFilters ? "rotate-180" : ""}`}
          >
            <path d="M5 8l5 5 5-5" />
          </svg>
        </button>
        <div
          id="feed-filters"
          className={`${showFilters ? "mt-3 grid" : "hidden"} grid-cols-2 gap-3 md:mt-0 md:grid md:grid-cols-4 md:items-end`}
        >
          <Select
            name="Event"
            className="col-span-2 md:col-span-1"
            value={filters.event_id}
            onChange={(v) => change("event_id", v)}
          >
            <option value="">All events</option>
            {feed.data?.filters.events.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </Select>
          <Select
            name="Place"
            className="col-span-2 md:col-span-1"
            value={filters.location_id}
            onChange={(v) => change("location_id", v)}
          >
            <option value="">All places</option>
            {feed.data?.filters.locations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
          <label className={labelClass}>
            <span className="mb-1.5 block">From</span>
            <input
              type="date"
              className={control}
              value={filters.from}
              onChange={(e) => change("from", e.target.value)}
            />
          </label>
          <label className={labelClass}>
            <span className="mb-1.5 block">To</span>
            <input
              type="date"
              className={control}
              value={filters.to}
              onChange={(e) => change("to", e.target.value)}
            />
          </label>
        </div>
      </form>

      {feed.isError && (
        <div className="mt-4">
          <Alert tone="error">{feed.error.message}</Alert>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
        <div className="relative flex min-h-12 items-center justify-between gap-3 border-b border-stone-200 px-4 md:px-5">
          <p className="text-sm text-stone-600 tabular-nums" aria-live="polite">
            {feed.isPending
              ? "Loading reports..."
              : `${total} ${total === 1 ? "report" : "reports"}, newest first`}
          </p>
          {active > 0 && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex min-h-10 items-center rounded-sm px-2 text-sm font-semibold text-maroon-700 underline-offset-2 hover:underline"
            >
              Clear filters ({active})
            </button>
          )}
          <div
            aria-hidden="true"
            className={`absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-maroon-700/10 transition-opacity ${feed.isFetching && !feed.isPending ? "opacity-100" : "opacity-0"}`}
          >
            <div className="h-full w-1/3 animate-pulse bg-maroon-700/60" />
          </div>
        </div>

        {feed.isPending ? (
          <div aria-hidden="true" className="space-y-4 p-5">
            <div className="h-16 animate-pulse rounded bg-stone-100" />
            <div className="h-16 animate-pulse rounded bg-stone-100" />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="font-semibold text-stone-900">
              {active > 0 ? "No reports match these filters" : "No reports yet"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {active > 0
                ? "Try another event or a wider date range."
                : "Reports from people on duty show up here."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {rows.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                onPhoto={() => setPhotoOf(report)}
              />
            ))}
          </ul>
        )}

        {lastPage > 1 && (
          <nav
            className="flex items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 md:px-5"
            aria-label="Pages"
          >
            <Button
              variant="secondary"
              size="md"
              disabled={page <= 1}
              onClick={() => goTo(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-stone-600 tabular-nums">
              Page {page} of {lastPage}
            </span>
            <Button
              variant="secondary"
              size="md"
              disabled={page >= lastPage}
              onClick={() => goTo(page + 1)}
            >
              Next
            </Button>
          </nav>
        )}
      </div>

      <Lightbox report={photoOf} onClose={() => setPhotoOf(null)} />
    </div>
  );
}
