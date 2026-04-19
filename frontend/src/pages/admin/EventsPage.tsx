import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError, eventApi, venueApi } from "@/services/api";
import type {
  EventCreatePayload,
  EventStatus,
  EventSummary,
} from "@/types/catalog";
import { formatDateTime } from "@/utils/format";

const STATUSES: EventStatus[] = ["DRAFT", "PUBLISHED", "ENDED"];

function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

const emptyForm = (): EventCreatePayload => ({
  venue_id: "",
  title: "",
  description: "",
  event_date: "",
  sale_start_at: "",
  banner_url: "",
  status: "DRAFT",
  grid_rows: 10,
  grid_cols: 15,
});

export function EventsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);

  const venuesQ = useQuery({ queryKey: ["venues"], queryFn: venueApi.list });
  const eventsQ = useQuery({
    queryKey: ["admin", "events"],
    queryFn: () => eventApi.list({ limit: 100 }),
  });

  const create = useMutation({
    mutationFn: (payload: EventCreatePayload) => eventApi.create(payload),
    onSuccess: () => {
      setForm(emptyForm());
      setError(null);
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Failed to create event"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EventStatus }) =>
      eventApi.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => eventApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!form.venue_id) {
      setError("Please select a venue.");
      return;
    }
    if (!form.event_date) {
      setError("Event date is required.");
      return;
    }
    const payload: EventCreatePayload = {
      venue_id: form.venue_id,
      title: form.title,
      description: form.description || null,
      event_date: fromLocalInput(form.event_date),
      sale_start_at: form.sale_start_at ? fromLocalInput(form.sale_start_at) : null,
      banner_url: form.banner_url || null,
      status: form.status,
      grid_rows: Number(form.grid_rows) || 10,
      grid_cols: Number(form.grid_cols) || 15,
    };
    create.mutate(payload);
  };

  const events: EventSummary[] = eventsQ.data ?? [];
  const venues = venuesQ.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-100">Events</h1>
        <p className="text-sm text-gray-500">
          Create events, toggle status, and configure seat zones.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-100">New event</h2>
        {venues.length === 0 ? (
          <p className="mt-3 text-sm text-amber-400">
            Create a venue first on the{" "}
            <Link to="/admin/venues" className="underline">
              Venues page
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input
              label="Title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Venue</label>
              <select
                required
                value={form.venue_id}
                onChange={(e) => setForm({ ...form, venue_id: e.target.value })}
                className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 shadow-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
              >
                <option value="">Select a venue…</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.city}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Event date &amp; time"
              type="datetime-local"
              required
              value={form.event_date}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
            />
            <Input
              label="Sale start (optional)"
              type="datetime-local"
              value={form.sale_start_at ?? ""}
              onChange={(e) => setForm({ ...form, sale_start_at: e.target.value })}
            />
            <Input
              label="Banner URL (optional)"
              value={form.banner_url ?? ""}
              onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as EventStatus })
                }
                className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 shadow-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Grid rows"
              type="number"
              min={1}
              max={100}
              required
              value={form.grid_rows}
              onChange={(e) =>
                setForm({ ...form, grid_rows: Number(e.target.value) })
              }
            />
            <Input
              label="Seats per row"
              type="number"
              min={1}
              max={100}
              required
              value={form.grid_cols}
              onChange={(e) =>
                setForm({ ...form, grid_cols: Number(e.target.value) })
              }
            />
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">
                Description
              </label>
              <textarea
                rows={3}
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 shadow-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
              />
              <p className="text-xs text-gray-500">
                Grid generates {form.grid_rows}×{form.grid_cols} = {form.grid_rows * form.grid_cols} seats.
                Assign zones on the Seats page.
              </p>
            </div>
            {error && (
              <p className="sm:col-span-2 rounded-md bg-red-950 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" loading={create.isPending}>
                Create event
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-gray-800 bg-gray-900 shadow-sm">
        <div className="border-b border-gray-800 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-100">All events</h2>
        </div>
        {eventsQ.isLoading ? (
          <p className="px-6 py-6 text-sm text-gray-500">Loading…</p>
        ) : events.length ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-800 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Venue</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="px-6 py-3 font-medium text-gray-100">{e.title}</td>
                  <td className="px-6 py-3 text-gray-400">
                    {e.venue.name} · {e.venue.city}
                  </td>
                  <td className="px-6 py-3 text-gray-400">
                    {formatDateTime(e.event_date)}
                  </td>
                  <td className="px-6 py-3">
                    <select
                      value={e.status}
                      onChange={(ev) =>
                        updateStatus.mutate({
                          id: e.id,
                          status: ev.target.value as EventStatus,
                        })
                      }
                      className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      to={`/admin/events/${e.id}/seats`}
                      className="mr-3 text-sm font-medium text-rose-400 hover:text-rose-300"
                    >
                      Seats
                    </Link>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete "${e.title}"?`)) remove.mutate(e.id);
                      }}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-6 py-6 text-sm text-gray-500">No events yet.</p>
        )}
      </section>
    </div>
  );
}
