import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { eventApi } from "@/services/api";
import type { EventStatus, EventSummary } from "@/types/catalog";
import { formatDateTime } from "@/utils/format";

const STATUSES: Array<{ value: EventStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "ENDED", label: "Ended" },
];

function mainImageUrl(event: EventSummary): string | null {
  if (event.images?.length) {
    const main = event.images.find((i) => i.is_main) ?? event.images[0];
    return main?.image_url ?? null;
  }
  return event.banner_url;
}

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
      <section className="hero-gradient rounded-3xl px-8 py-12 shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-widest opacity-80">
          TicketRush
        </p>
        <h1 className="mt-2 text-4xl font-bold leading-tight sm:text-5xl">
          Snag the best seats without the chaos.
        </h1>
        <p className="mt-3 max-w-xl opacity-90">
          Real-time seating maps, fair queues, and lightning-fast checkout.
        </p>
      </section>

      <section
        className="flex flex-col gap-4 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-end"
        style={{
          borderColor: "var(--border-primary)",
          background: "var(--bg-secondary)",
        }}
      >
        <div className="flex-1">
          <label
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Search
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Concert, festival, artist…"
            className="input-field mt-1"
          />
        </div>
        <div className="w-full sm:w-48">
          <label
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            City
          </label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Any"
            className="input-field mt-1"
          />
        </div>
        <div className="w-full sm:w-48">
          <label
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EventStatus | "")}
            className="input-field mt-1"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <label
          className="flex items-center gap-2 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          <input
            type="checkbox"
            checked={upcoming}
            onChange={(e) => setUpcoming(e.target.checked)}
            className="h-4 w-4 rounded"
            style={{ accentColor: "var(--accent)" }}
          />
          Upcoming only
        </label>
      </section>

      <section>
        {isLoading && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading events…
          </p>
        )}
        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            Failed to load events. Please retry.
          </p>
        )}
        {data && data.length === 0 && (
          <div
            className="rounded-2xl border border-dashed p-10 text-center text-sm"
            style={{
              borderColor: "var(--border-primary)",
              background: "var(--bg-secondary)",
              color: "var(--text-muted)",
            }}
          >
            No events match your filters.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((event) => {
            const img = mainImageUrl(event);
            return (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5"
                style={{
                  borderColor: "var(--border-primary)",
                  background: "var(--bg-secondary)",
                }}
              >
                <div
                  className="h-40 w-full bg-cover bg-center"
                  style={
                    img
                      ? {
                          backgroundImage: `url(${img})`,
                        }
                      : {
                          background:
                            "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)",
                        }
                  }
                />
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <div
                    className="flex items-center justify-between text-xs font-medium uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span>{event.venue.city}</span>
                    <span
                      className={`badge ${
                        event.status === "PUBLISHED"
                          ? "badge-success"
                          : event.status === "ENDED"
                            ? "badge-muted"
                            : "badge-warning"
                      }`}
                    >
                      {event.status}
                    </span>
                  </div>
                  <h3
                    className="text-lg font-semibold transition group-hover:text-[color:var(--accent)]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {event.title}
                  </h3>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {event.venue.name}
                  </p>
                  <p
                    className="mt-auto text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatDateTime(event.event_date)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
