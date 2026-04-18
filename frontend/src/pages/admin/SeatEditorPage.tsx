import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { SeatCanvas, type SeatVisual } from "@/components/seating/SeatCanvas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ApiError,
  eventApi,
  seatApi,
  seatAdminApi,
  zoneApi,
} from "@/services/api";
import type { SeatWithZone } from "@/types/booking";
import type { Zone, ZoneCreatePayload } from "@/types/catalog";
import { formatCurrency } from "@/utils/format";

const emptyZone = (): ZoneCreatePayload => ({
  name: "",
  price: "",
  color: "#4f46e5",
});

export function SeatEditorPage() {
  const { id: eventId = "" } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [zoneForm, setZoneForm] = useState(emptyZone());
  const [error, setError] = useState<string | null>(null);

  const eventQ = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventApi.get(eventId),
    enabled: Boolean(eventId),
  });

  const seatsQ = useQuery({
    queryKey: ["event", eventId, "seats"],
    queryFn: () => seatApi.listForEvent(eventId),
    enabled: Boolean(eventId),
  });

  const zonesQ = useQuery({
    queryKey: ["event", eventId, "zones"],
    queryFn: () => zoneApi.listForEvent(eventId),
    enabled: Boolean(eventId),
  });

  const seats = seatsQ.data ?? [];
  const zones = zonesQ.data ?? [];

  const createZone = useMutation({
    mutationFn: (payload: ZoneCreatePayload) => zoneApi.create(eventId, payload),
    onSuccess: () => {
      setZoneForm(emptyZone());
      setError(null);
      qc.invalidateQueries({ queryKey: ["event", eventId, "zones"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Failed to create zone"),
  });

  const removeZone = useMutation({
    mutationFn: (zoneId: string) => zoneApi.remove(zoneId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", eventId, "zones"] });
      qc.invalidateQueries({ queryKey: ["event", eventId, "seats"] });
    },
  });

  const bulkAssign = useMutation({
    mutationFn: (zoneId: string | null) =>
      seatAdminApi.bulkAssign(eventId, Array.from(selected), zoneId),
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["event", eventId, "seats"] });
      qc.invalidateQueries({ queryKey: ["event", eventId, "zones"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Failed to assign zone"),
  });

  const toggleSeat = useCallback((seat: SeatWithZone) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else next.add(seat.id);
      return next;
    });
  }, []);

  const onMarquee = useCallback(
    (ids: string[], mode: "replace" | "add") => {
      setSelected((prev) => {
        if (mode === "replace") return new Set(ids);
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
    },
    [],
  );

  const visualFor = useCallback(
    (seat: SeatWithZone): SeatVisual => {
      if (selected.has(seat.id)) return "selected";
      if (!seat.zone_id) return "unassigned";
      return "available";
    },
    [selected],
  );

  const colorFor = useCallback(
    (seat: SeatWithZone): string | null => seat.zone_color ?? null,
    [],
  );

  const submitZone = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!zoneForm.name || !zoneForm.price) {
      setError("Zone name and price are required.");
      return;
    }
    createZone.mutate(zoneForm);
  };

  const selectedCount = selected.size;
  const assignedCount = useMemo(
    () => seats.filter((s) => s.zone_id).length,
    [seats],
  );
  const event = eventQ.data;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          to="/admin/events"
          className="text-sm text-indigo-600 hover:text-indigo-500"
        >
          ← All events
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Seat matrix · {event?.title ?? "…"}
        </h1>
        <p className="text-sm text-slate-500">
          {event
            ? `Grid ${event.grid_rows} rows × ${event.grid_cols} seats · ${assignedCount}/${seats.length} assigned`
            : "Loading…"}
          {" · "}Drag empty area to box-select · Shift to add
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="flex flex-col gap-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Zones</h2>
            <form onSubmit={submitZone} className="mt-4 flex flex-col gap-3">
              <Input
                label="Zone name"
                required
                value={zoneForm.name}
                onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
              />
              <Input
                label="Price"
                required
                type="number"
                step="0.01"
                min={0}
                value={zoneForm.price}
                onChange={(e) => setZoneForm({ ...zoneForm, price: e.target.value })}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Color</label>
                <input
                  type="color"
                  value={zoneForm.color}
                  onChange={(e) => setZoneForm({ ...zoneForm, color: e.target.value })}
                  className="h-10 w-full rounded-md border border-slate-300"
                />
              </div>
              <Button type="submit" loading={createZone.isPending}>
                Add zone
              </Button>
              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
            </form>

            <ul className="mt-5 flex flex-col gap-2">
              {zones.length === 0 ? (
                <li className="text-sm text-slate-500">
                  No zones yet. Create one, then drag across seats on the canvas.
                </li>
              ) : (
                zones.map((z) => (
                  <li
                    key={z.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: z.color }}
                      />
                      <span className="truncate font-medium text-slate-800">
                        {z.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatCurrency(z.price)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={selectedCount === 0 || bulkAssign.isPending}
                        onClick={() => bulkAssign.mutate(z.id)}
                        className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                        title={
                          selectedCount === 0
                            ? "Select seats first"
                            : `Assign ${selectedCount} seats`
                        }
                      >
                        Assign
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              `Remove zone "${z.name}"? Its seats become unassigned.`,
                            )
                          )
                            removeZone.mutate(z.id);
                        }}
                        className="text-xs text-red-600 hover:text-red-500"
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <SelectionPanel
            count={selectedCount}
            onClear={() => setSelected(new Set())}
            onUnassign={() => bulkAssign.mutate(null)}
            unassigning={bulkAssign.isPending}
          />

          <Legend zones={zones} />
        </aside>

        <section className="min-w-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            {event ? (
              <SeatCanvas
                seats={seats}
                rows={event.grid_rows}
                cols={event.grid_cols}
                visualFor={visualFor}
                colorFor={colorFor}
                onSeatClick={toggleSeat}
                onMarqueeSelect={onMarquee}
                width={900}
                height={620}
              />
            ) : (
              <p className="p-10 text-center text-sm text-slate-500">Loading…</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

interface SelectionPanelProps {
  count: number;
  onClear: () => void;
  onUnassign: () => void;
  unassigning: boolean;
}

function SelectionPanel({
  count,
  onClear,
  onUnassign,
  unassigning,
}: SelectionPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Selection</h2>
      <p className="mt-1 text-sm text-slate-500">
        {count === 0
          ? "Drag a box on the canvas, or click individual seats."
          : `${count} seat${count === 1 ? "" : "s"} selected.`}
      </p>
      {count > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onClear}>
            Clear
          </Button>
          <Button
            variant="ghost"
            onClick={onUnassign}
            loading={unassigning}
            className="border border-slate-200"
          >
            Unassign
          </Button>
        </div>
      )}
    </section>
  );
}

function Legend({ zones }: { zones: Zone[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Legend</h2>
      <ul className="mt-3 flex flex-col gap-1.5 text-xs text-slate-600">
        <LegendRow color="#e2e8f0" label="Unassigned" />
        <LegendRow color="#6366f1" label="Selected" />
        {zones.map((z) => (
          <LegendRow key={z.id} color={z.color} label={z.name} />
        ))}
      </ul>
    </section>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <li className="inline-flex items-center gap-2">
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </li>
  );
}
