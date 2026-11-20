// A-Reports, Needs attention (the landing tab). One summary strip, then open emergencies (with a
// quick Acknowledge), overdue and missed reports, and a count for each event.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { Alert } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import { acknowledgeEmergency, getAttention, type Attention } from "../../api";
import { StatusChip, TypeIcon } from "../../components/emergencyUi";
import { linkClass, Panel, stamp } from "../../components/reportsUi";

function Stat({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot: string;
}) {
  return (
    <div className="bg-white px-4 py-4 md:px-5">
      <p className="flex items-center gap-2 text-sm text-stone-600">
        <span
          aria-hidden="true"
          className={`size-2 rounded-full ${value > 0 ? dot : "bg-stone-300"}`}
        />
        {label}
      </p>
      <p
        className={`mt-1 text-3xl font-semibold tracking-tight tabular-nums ${value > 0 ? "text-stone-900" : "text-stone-300"}`}
      >
        {value}
      </p>
    </div>
  );
}

function EmergencyRow({ e }: { e: Attention["emergencies"][number] }) {
  const queryClient = useQueryClient();
  const ack = useMutation({
    mutationFn: () => acknowledgeEmergency(e.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attention"] }),
        queryClient.invalidateQueries({ queryKey: ["emergencies"] }),
      ]);
    },
  });
  const waiting = e.status === "sent";

  return (
    <li
      className={`relative px-4 py-4 md:px-5 ${waiting ? "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-red-700" : ""}`}
    >
      <div className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-3 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-x-4">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-control ring-1 ${waiting ? "text-red-700 ring-red-200" : "text-stone-500 ring-stone-200"}`}
        >
          <TypeIcon type={e.type} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-semibold text-stone-900">
              <span className="capitalize">{e.type}</span> ·{" "}
              {e.reporter ?? "Unknown"}
            </p>
            {waiting ? (
              <StatusChip
                kind={e.escalated ? "escalated" : "new"}
                label={e.escalated ? "Escalated" : "Not acknowledged"}
              />
            ) : (
              <StatusChip kind="acknowledged" />
            )}
          </div>
          <p className="mt-0.5 text-sm text-stone-600">
            {e.event ?? "Event"} · sent{" "}
            <span className="tabular-nums">
              {stamp.format(new Date(e.sent_at))}
            </span>
            {!waiting && ` · taken on by ${e.acknowledged_by ?? "someone"}`}
          </p>
        </div>
        <div className="col-span-2 flex gap-2 md:col-span-1">
          {waiting && (
            <Button
              size="md"
              className="flex-1 md:flex-none"
              loading={ack.isPending}
              onClick={() => ack.mutate()}
            >
              {ack.isPending ? "Acknowledging..." : "Acknowledge"}
            </Button>
          )}
          <Link
            to={`/admin/reports/emergencies?open=${e.id}`}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-control border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50 md:flex-none"
          >
            View details
          </Link>
        </div>
      </div>
      {ack.isError && (
        <div className="mt-3">
          <Alert tone="error">{ack.error.message}</Alert>
        </div>
      )}
    </li>
  );
}

function Cell({ n, tone }: { n: number; tone: string }) {
  return (
    <td className="px-2 py-3.5 text-right tabular-nums sm:px-5">
      <span className={n > 0 ? `font-semibold ${tone}` : "text-stone-400"}>
        {n}
      </span>
    </td>
  );
}

const headCell =
  "px-2 py-3 text-right text-xs font-semibold tracking-wide text-stone-500 uppercase sm:px-5";

export function NeedsAttention() {
  const attention = useQuery({
    queryKey: ["attention"],
    queryFn: getAttention,
    refetchInterval: 30_000,
  });

  if (attention.isPending)
    return (
      <div aria-hidden="true" className="space-y-6">
        <div className="h-24 animate-pulse rounded-card bg-stone-200" />
        <div className="h-48 animate-pulse rounded-card bg-stone-200" />
      </div>
    );
  if (attention.isError)
    return (
      <div className="max-w-xl space-y-3">
        <Alert tone="error">
          This view did not load. Check your connection.
        </Alert>
        <Button
          variant="secondary"
          size="md"
          onClick={() => void attention.refetch()}
        >
          Retry
        </Button>
      </div>
    );

  const { emergencies, reports, events } = attention.data;
  const waiting = emergencies.filter((e) => e.status === "sent").length;
  const overdue = reports.filter((r) => r.status === "overdue").length;
  const missed = reports.filter((r) => r.status === "missed").length;
  const nothing = emergencies.length === 0 && reports.length === 0;

  return (
    <div className="space-y-6">
      <div
        role="group"
        aria-label="Summary"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-card bg-stone-200 ring-1 ring-stone-200 lg:grid-cols-4"
      >
        <Stat label="Not acknowledged" value={waiting} dot="bg-red-700" />
        <Stat
          label="Taken on"
          value={emergencies.length - waiting}
          dot="bg-green-700"
        />
        <Stat label="Overdue reports" value={overdue} dot="bg-ember-600" />
        <Stat label="Missed reports" value={missed} dot="bg-red-700" />
      </div>

      {nothing && (
        <div className="flex flex-col items-center rounded-card bg-white px-6 py-12 text-center ring-1 ring-stone-200">
          <span className="flex size-12 items-center justify-center rounded-control border border-stone-200 text-green-700">
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h2 className="mt-4 text-lg font-semibold text-stone-900">
            All clear
          </h2>
          <p className="mt-1 max-w-sm text-pretty text-stone-600">
            No open emergencies and no overdue or missed reports. This page
            checks again every 30 seconds.
          </p>
        </div>
      )}

      {emergencies.length > 0 && (
        <Panel
          id="attention-emergencies"
          title="Open emergencies"
          aside={
            <Link to="/admin/reports/emergencies" className={linkClass}>
              Open inbox
            </Link>
          }
        >
          <ul className="divide-y divide-stone-100">
            {emergencies.map((e) => (
              <EmergencyRow key={e.id} e={e} />
            ))}
          </ul>
        </Panel>
      )}

      {reports.length > 0 && (
        <Panel id="attention-reports" title="Overdue and missed reports">
          <ul className="divide-y divide-stone-100">
            {reports.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-4 px-4 py-3.5 md:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900">
                    {r.author ?? "Unknown"}
                  </p>
                  <p className="text-sm text-stone-600">
                    {r.event ?? "Event"} · due{" "}
                    <span className="tabular-nums">
                      {stamp.format(new Date(r.due_at))}
                    </span>
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${r.status === "missed" ? "bg-red-100 text-red-900 ring-red-300" : "bg-ember-50 text-ember-700 ring-ember-200"}`}
                >
                  {r.status === "missed" ? "Missed" : "Overdue"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        id="attention-events"
        title="Reports for each event"
        aside={
          <Link to="/admin/reports/feed" className={linkClass}>
            Read the reports
          </Link>
        }
      >
        {events.length === 0 ? (
          <p className="px-4 py-8 text-center text-stone-600 md:px-5">
            No reports have fallen due yet.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className={`${headCell} !text-left !px-4 md:!px-5`}>
                  Event
                </th>
                <th className={headCell}>On time</th>
                <th className={headCell}>Late</th>
                <th className={headCell}>Overdue</th>
                <th className={`${headCell} sm:!pr-5`}>Missed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {events.map((ev) => (
                <tr key={ev.event_id}>
                  <td className="py-3.5 pr-2 pl-4 font-medium md:pl-5">
                    <Link
                      to={`/admin/reports/feed?event_id=${ev.event_id}`}
                      className="text-stone-900 hover:text-maroon-700 hover:underline"
                    >
                      {ev.event}
                    </Link>
                  </td>
                  <Cell n={ev.on_time} tone="text-green-800" />
                  <Cell n={ev.late} tone="text-amber-900" />
                  <Cell n={ev.overdue} tone="text-ember-700" />
                  <Cell n={ev.missed} tone="text-red-800" />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
