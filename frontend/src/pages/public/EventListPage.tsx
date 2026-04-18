import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { eventApi } from "@/services/api";
import type { EventStatus } from "@/types/catalog";
import { formatDateTime } from "@/utils/format";

const STATUSES: Array<{ value: EventStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "ENDED", label: "Ended" },
];

export function EventListPage() {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [statusFilter, setStatusFilter] = useState<EventStatus | "">("PUBLISHED");
  const [upcoming, setUpcoming] = useState(true);

  const query = useMemo(
    () => ({
      q: q.trim() || undefined,
      city: city.trim() || undefined,
      status: statusFilter || undefined,
      upcoming,
    }),
    [q, city, statusFilter, upcoming],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", query],
    queryFn: () => eventApi.list(query),
  });

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-500 px-8 py-12 text-white shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-100">
          TicketRush
        </p>
        <h1 className="mt-2 text-4xl font-bold leading-tight sm:text-5xl">
          Snag the best seats without the chaos.
        </h1>
        <p className="mt-3 max-w-xl text-indigo-100">
          Real-time seating maps, fair queues, and lightning-fast checkout.
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Search
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Concert, festival, artist…"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
          />
        </div>
        <div className="w-full sm:w-48">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-500">
            City
          </label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Any"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
          />
        </div>
        <div className="w-full sm:w-48">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EventStatus | "")}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={upcoming}
            onChange={(e) => setUpcoming(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Upcoming only
        </label>
      </section>

      <section>
        {isLoading && <p className="text-sm text-slate-500">Loading events…</p>}
        {error && (
          <p className="text-sm text-red-600">Failed to load events. Please retry.</p>
        )}
        {data && data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            No events match your filters.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
            >
              <div
                className="h-36 bg-gradient-to-br from-indigo-500 to-purple-500"
                style={
                  event.banner_url
                    ? { backgroundImage: `url(${event.banner_url})`, backgroundSize: "cover" }
                    : undefined
                }
              />
              <div className="flex flex-1 flex-col gap-2 p-5">
                <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-500">
                  <span>{event.venue.city}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      event.status === "PUBLISHED"
                        ? "bg-emerald-100 text-emerald-700"
                        : event.status === "ENDED"
                          ? "bg-slate-200 text-slate-600"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {event.status}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600">
                  {event.title}
                </h3>
                <p className="text-sm text-slate-600">{event.venue.name}</p>
                <p className="mt-auto text-xs text-slate-500">
                  {formatDateTime(event.event_date)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
