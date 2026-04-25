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
    if (seatsQ.data) {
      setAll(seatsQ.data);
      if (user) {
        const mine = seatsQ.data
          .filter((s) => s.status === "LOCKED" && s.locked_by === user.id)
          .map((s) => s.id);
        
        const currentSelected = useSeatStore.getState().selectedIds;
        const toAdd = mine.filter(id => !currentSelected.includes(id));
        if (toAdd.length > 0) {
          setSelected([...currentSelected, ...toAdd]);
        }
      }
    }
  }, [seatsQ.data, setAll, user, setSelected]);

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
          className="text-sm hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          ← Back to event
        </button>
        <h1
          className="mt-1 text-2xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {event ? event.title : "Pick your seats"}
        </h1>
        {event && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {formatDateTime(event.event_date)} · {event.venue.name}
          </p>
        )}
      </header>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Loading seats…
        </p>
      ) : seatsArray.length === 0 || !event ? (
        <div
          className="rounded-2xl border border-dashed p-10 text-center text-sm"
          style={{
            borderColor: "var(--border-primary)",
            background: "var(--bg-secondary)",
            color: "var(--text-muted)",
          }}
        >
          No seats configured for this event yet.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <section
            className="rounded-2xl border p-3 shadow-sm"
            style={{
              borderColor: "var(--border-primary)",
              background: "var(--bg-secondary)",
            }}
          >
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

          <aside
            className="flex flex-col gap-4 rounded-2xl border p-5 shadow-sm"
            style={{
              borderColor: "var(--border-primary)",
              background: "var(--bg-secondary)",
            }}
          >
            <div>
              <h2
                className="text-base font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Your selection
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Seats are held for 10 minutes while you check out.
              </p>
            </div>
            {selected.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Tap a seat to select it.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {selected.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                    style={{
                      borderColor: "var(--border-primary)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: s.zone_color ?? "#4b5563" }}
                      />
                      {s.zone_name} · R{s.row_number} S{s.seat_number}
                    </span>
                    <span
                      className="font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatCurrency(s.price ?? "0")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div
              className="flex items-center justify-between border-t pt-4 text-sm"
              style={{ borderColor: "var(--border-primary)" }}
            >
              <span style={{ color: "var(--text-muted)" }}>Total</span>
              <span
                className="text-lg font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {formatCurrency(total)}
              </span>
            </div>
            {error && (
              <p
                className="rounded-md px-3 py-2 text-sm"
                style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
              >
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
    <div
      className="mt-3 flex flex-wrap items-center gap-4 text-xs"
      style={{ color: "var(--text-secondary)" }}
    >
      <LegendSwatch color="#475569" label="Unassigned" />
      <LegendSwatch color="#8b5cf6" label="Your pick" />
      <LegendSwatch color="#94a3b8" label="Held" />
      <LegendSwatch color="#64748b" label="Sold" />
      <LegendSwatch color="#f43f5e" label="Selecting" />
      <span
        className="mx-2 h-3 w-px"
        style={{ background: "var(--border-primary)" }}
      />
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
