import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { eventApi, zoneApi } from "@/services/api";
import { formatCurrency, formatDateTime } from "@/utils/format";

export function EventDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const eventQ = useQuery({
    queryKey: ["event", id],
    queryFn: () => eventApi.get(id),
    enabled: Boolean(id),
  });

  const zonesQ = useQuery({
    queryKey: ["event", id, "zones"],
    queryFn: () => zoneApi.listForEvent(id),
    enabled: Boolean(id),
  });

  if (eventQ.isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (eventQ.error || !eventQ.data) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        Event not found.{" "}
        <Link to="/" className="text-indigo-600 hover:text-indigo-500">
          Back to events
        </Link>
      </div>
    );
  }

  const event = eventQ.data;
  const zones = zonesQ.data ?? [];
  const totalSeats = zones.reduce((sum, z) => sum + z.seat_count, 0);

  return (
    <div className="flex flex-col gap-8">
      <section
        className="rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-500 p-10 text-white shadow-lg"
        style={
          event.banner_url
            ? {
                backgroundImage: `linear-gradient(rgba(30, 27, 75, 0.55), rgba(30, 27, 75, 0.55)), url(${event.banner_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-100">
          {event.status}
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{event.title}</h1>
        <p className="mt-2 text-indigo-100">{formatDateTime(event.event_date)}</p>
        <p className="text-sm text-indigo-100">
          {event.venue.name} · {event.venue.city}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">About this event</h2>
          <p className="mt-3 whitespace-pre-line text-sm text-slate-600">
            {event.description || "No description provided."}
          </p>
        </section>

        <aside className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Zones &amp; pricing</h2>
            <p className="text-xs text-slate-500">
              {zones.length} zones · {totalSeats} total seats
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {zones.length === 0 ? (
              <li className="text-sm text-slate-500">No zones configured yet.</li>
            ) : (
              zones.map((z) => (
                <li
                  key={z.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: z.color }}
                    />
                    <span className="font-medium text-slate-800">{z.name}</span>
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(z.price)}
                  </span>
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
            onClick={() => {
              if (!user) {
                navigate("/login", {
                  state: { from: { pathname: `/events/${event.id}/book` } },
                });
              } else {
                navigate(`/events/${event.id}/book`);
              }
            }}
            disabled={event.status !== "PUBLISHED" || zones.length === 0}
            className="mt-2 inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            {event.status === "PUBLISHED"
              ? zones.length === 0
                ? "No seats configured"
                : "Book seats"
              : "Not on sale"}
          </button>
        </aside>
      </div>
    </div>
  );
}
