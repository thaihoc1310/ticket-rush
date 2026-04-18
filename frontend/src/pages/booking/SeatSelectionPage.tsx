import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { SeatCanvas, type SeatVisual } from "@/components/seating/SeatCanvas";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useSeatWebSocket } from "@/hooks/useSeatWebSocket";
import { ApiError, bookingApi, eventApi, seatApi } from "@/services/api";
import { useSeatStore } from "@/store/seatStore";
import type { SeatWithZone } from "@/types/booking";
import type { Zone } from "@/types/catalog";
import { formatCurrency, formatDateTime } from "@/utils/format";

export function SeatSelectionPage() {
  const { id: eventId = "" } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { seats, selectedIds, setAll, applyUpdate, toggleSelect, setSelected } =
    useSeatStore();
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

  useEffect(() => {
    setSelected([]);
    return () => setSelected([]);
  }, [eventId, setSelected]);

  useEffect(() => {
    if (seatsQ.data) setAll(seatsQ.data);
  }, [seatsQ.data, setAll]);

  useSeatWebSocket(eventId, (msg) => {
    applyUpdate(msg.seat_id, {
      status: msg.status,
      locked_by: msg.locked_by,
    });
  });

  const seatsArray = useMemo(() => Object.values(seats), [seats]);
  const selected = useMemo(
    () => selectedIds.map((id) => seats[id]).filter(Boolean),
    [selectedIds, seats],
  );
  const zonesInUse: Zone[] = useMemo(() => {
    const m = new Map<string, Zone>();
    for (const s of seatsArray) {
      if (s.zone_id && s.zone_name && s.zone_color && s.price && !m.has(s.zone_id)) {
        m.set(s.zone_id, {
          id: s.zone_id,
          event_id: s.event_id,
          name: s.zone_name,
          price: s.price,
          color: s.zone_color,
          seat_count: 0,
        });
      }
    }
    return Array.from(m.values());
  }, [seatsArray]);
  const total = useMemo(
    () =>
      selected.reduce(
        (sum, s) => sum + Number.parseFloat(s.price ?? "0"),
        0,
      ),
    [selected],
  );

  const lock = useMutation({ mutationFn: (id: string) => seatApi.lock(id) });
  const unlock = useMutation({ mutationFn: (id: string) => seatApi.unlock(id) });

  const onSeatClick = useCallback(
    async (seat: SeatWithZone) => {
      setError(null);
      if (!seat.zone_id) return; // unassigned → ignore
      if (!user) {
        navigate("/login", {
          state: { from: { pathname: `/events/${eventId}/book` } },
        });
        return;
      }
      const mine = seat.locked_by === user.id;
      if (seat.status === "SOLD") return;
      if (seat.status === "LOCKED" && !mine) return;

      if (mine) {
        try {
          await unlock.mutateAsync(seat.id);
          applyUpdate(seat.id, { status: "AVAILABLE", locked_by: null });
          setSelected(selectedIds.filter((x) => x !== seat.id));
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Failed to release seat");
        }
        return;
      }
      try {
        await lock.mutateAsync(seat.id);
        applyUpdate(seat.id, { status: "LOCKED", locked_by: user.id });
        toggleSelect(seat.id);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : "Seat is no longer available",
        );
      }
    },
    [
      applyUpdate,
      eventId,
      lock,
      navigate,
      selectedIds,
      setSelected,
      toggleSelect,
      unlock,
      user,
    ],
  );

  const visualFor = useCallback(
    (seat: SeatWithZone): SeatVisual => {
      if (!seat.zone_id) return "unassigned";
      if (seat.status === "SOLD") return "sold";
      if (seat.status === "LOCKED") {
        if (user && seat.locked_by === user.id) return "mine";
        return "locked";
      }
      return "available";
    },
    [user],
  );

  const colorFor = useCallback(
    (seat: SeatWithZone): string | null => seat.zone_color ?? null,
    [],
  );

  const createBooking = useMutation({
    mutationFn: () => bookingApi.create(eventId, selectedIds),
    onSuccess: (booking) => {
      setSelected([]);
      navigate(`/checkout/${booking.id}`);
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Unable to create booking"),
  });

  const event = eventQ.data;
  const loading = eventQ.isLoading || seatsQ.isLoading;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <button
          type="button"
          onClick={() => navigate(`/events/${eventId}`)}
          className="text-sm text-indigo-600 hover:text-indigo-500"
        >
          ← Back to event
        </button>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {event ? event.title : "Pick your seats"}
        </h1>
        {event && (
          <p className="text-sm text-slate-500">
            {formatDateTime(event.event_date)} · {event.venue.name}
          </p>
        )}
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">Loading seats…</p>
      ) : seatsArray.length === 0 || !event ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No seats configured for this event yet.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <SeatCanvas
              seats={seatsArray}
              rows={event.grid_rows}
              cols={event.grid_cols}
              visualFor={visualFor}
              colorFor={colorFor}
              onSeatClick={onSeatClick}
              width={900}
              height={560}
            />
            <CustomerLegend zones={zonesInUse} />
          </section>

          <aside className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Your selection
              </h2>
              <p className="text-xs text-slate-500">
                Seats are held for 10 minutes while you check out.
              </p>
            </div>
            {selected.length === 0 ? (
              <p className="text-sm text-slate-500">Tap a seat to select it.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {selected.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: s.zone_color ?? "#cbd5e1" }}
                      />
                      {s.zone_name} · R{s.row_number} S{s.seat_number}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(s.price ?? "0")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-sm">
              <span className="text-slate-500">Total</span>
              <span className="text-lg font-semibold text-slate-900">
                {formatCurrency(total)}
              </span>
            </div>
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button
              onClick={() => createBooking.mutate()}
              disabled={selected.length === 0}
              loading={createBooking.isPending}
            >
              Continue to checkout
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}

function CustomerLegend({ zones }: { zones: Zone[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
      <LegendSwatch color="#e2e8f0" label="Unassigned" />
      <LegendSwatch color="#f59e0b" label="Your pick" />
      <LegendSwatch color="#94a3b8" label="Held" />
      <LegendSwatch color="#ef4444" label="Sold" />
      <span className="mx-2 h-3 w-px bg-slate-200" />
      {zones.map((z) => (
        <LegendSwatch
          key={z.id}
          color={z.color}
          label={`${z.name} · ${formatCurrency(z.price)}`}
        />
      ))}
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
