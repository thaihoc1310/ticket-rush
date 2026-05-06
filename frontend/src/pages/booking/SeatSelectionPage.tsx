import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReconnectingWebSocket from "reconnecting-websocket";

import { SeatCanvas, type SeatVisual } from "@/components/seating/SeatCanvas";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useSeatWebSocket } from "@/hooks/useSeatWebSocket";
import { ApiError, bookingApi, eventApi, queueApi, seatApi } from "@/services/api";
import { SEAT_LOCK_TTL, useSeatStore } from "@/store/seatStore";
import { useQueueStore } from "@/store/queueStore";
import type { SeatWithZone } from "@/types/booking";
import type { Zone } from "@/types/catalog";
import { formatCurrency, formatDateTime } from "@/utils/format";

function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return "00:00";
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getRemainingSeconds(lockedAt: string): number {
  const lockTime = new Date(lockedAt).getTime();
  const expiry = lockTime + SEAT_LOCK_TTL * 1000;
  return Math.max(0, Math.floor((expiry - Date.now()) / 1000));
}

export function SeatSelectionPage() {
  const { id: eventId = "" } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [queueChecked, setQueueChecked] = useState(false);
  /** true when user is navigating to checkout — skip releasing queue slot */
  const goingToCheckout = useRef(false);
  /** true when queue was active and user was granted access */
  const wasQueueGranted = useRef(false);

  // ── Session TTL state ──
  const [sessionTtl, setSessionTtl] = useState<number | null>(null); // seconds
  const [grantedAt, setGrantedAt] = useState<number | null>(null); // unix ts
  const [sessionExpired, setSessionExpired] = useState(false);

  // ── Queue gate: check if user needs to wait ──
  useEffect(() => {
    if (!eventId || !user) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await queueApi.join(eventId);
        if (cancelled) return;
        if (res.status === "WAITING") {
          useQueueStore.getState().setStatus("WAITING");
          useQueueStore.getState().setPosition(res.position, res.queue_size);
          useQueueStore.getState().setEventId(eventId);
          navigate(`/events/${eventId}/queue`, { replace: true });
          return;
        }
        wasQueueGranted.current = res.status === "GRANTED";
        if (res.status === "GRANTED" && res.session_ttl_seconds && res.granted_at) {
          setSessionTtl(res.session_ttl_seconds);
          setGrantedAt(res.granted_at);
        }
        setQueueChecked(true);
      } catch {
        setQueueChecked(true);
      }
    })();

    return () => { cancelled = true; };
  }, [eventId, user, navigate]);

  // ── Release queue slot when leaving the page ──
  useEffect(() => {
    return () => {
      if (goingToCheckout.current) return;
      if (!wasQueueGranted.current) return;
      queueApi.leave(eventId).catch(() => {});
    };
  }, [eventId]);

  // ── Listen for server-side session_expired via queue WS ──
  useEffect(() => {
    if (!eventId || !user || !queueChecked || !wasQueueGranted.current) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/queue/${eventId}`;
    const ws = new ReconnectingWebSocket(url, [], {
      maxRetries: 5,
      maxReconnectionDelay: 10_000,
      minReconnectionDelay: 500,
      connectionTimeout: 4000,
    });

    const onMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "session_expired" && data.user_id === user.id) {
          setSessionExpired(true);
        }
      } catch { /* ignore */ }
    };

    ws.addEventListener("message", onMessage);
    return () => {
      ws.removeEventListener("message", onMessage);
      ws.close();
    };
  }, [eventId, user, queueChecked]);

  // ── Auto-kick when session expires (client-side or server-side) ──
  useEffect(() => {
    if (!sessionExpired) return;
    // Unlock all selected seats and navigate away
    const ids = useSeatStore.getState().selectedIds;
    for (const id of ids) {
      seatApi.unlock(id).catch(() => {});
    }
    wasQueueGranted.current = false; // prevent double leave
    queueApi.leave(eventId).catch(() => {});
    navigate(`/events/${eventId}`, { replace: true });
  }, [sessionExpired, eventId, navigate]);

  const {
    seats,
    selectedIds,
    lockTimers,
    setAll,
    applyUpdate,
    toggleSelect,
    setSelected,
    setLockTime,
    removeLockTime,
  } = useSeatStore();
  const [error, setError] = useState<string | null>(null);
  // Tick state to force re-render every second for countdowns.
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const eventQ = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventApi.get(eventId),
    enabled: Boolean(eventId),
  });
  const seatsQ = useQuery({
    queryKey: ["event", eventId, "seats"],
    queryFn: () => seatApi.listForEvent(eventId),
    enabled: Boolean(eventId),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    setSelected([]);
    return () => setSelected([]);
  }, [eventId, setSelected]);

  // Always push seat data into the canvas store (even from cache).
  useEffect(() => {
    if (seatsQ.data) {
      setAll(seatsQ.data);
    }
  }, [seatsQ.data, setAll]);

  // Sync selectedIds + lockTimers only from FRESH data (skip stale cache).
  // When stale cache is returned first, isFetching=true → skip.
  // When background refetch completes, isFetching=false → sync.
  useEffect(() => {
    if (seatsQ.data && !seatsQ.isFetching && user) {
      const mine = seatsQ.data.filter(
        (s) => s.status === "LOCKED" && s.locked_by === user.id,
      );
      setSelected(mine.map((s) => s.id));
      for (const s of mine) {
        if (s.locked_at) {
          setLockTime(s.id, s.locked_at);
        }
      }
    }
  }, [seatsQ.data, seatsQ.isFetching, user, setSelected, setLockTime]);

  useSeatWebSocket(eventId, (msg) => {
    applyUpdate(msg.seat_id, {
      status: msg.status,
      locked_by: msg.locked_by,
    });
  });

  // Auto-deselect seats whose timer expired.
  useEffect(() => {
    const timers = useSeatStore.getState().lockTimers;
    const ids = useSeatStore.getState().selectedIds;
    const expiredIds = ids.filter((id) => {
      const lockedAt = timers[id];
      if (!lockedAt) return false;
      return getRemainingSeconds(lockedAt) <= 0;
    });
    if (expiredIds.length > 0) {
      setSelected(ids.filter((id) => !expiredIds.includes(id)));
      for (const id of expiredIds) {
        removeLockTime(id);
        // Optimistic: update canvas immediately instead of waiting for sweeper.
        applyUpdate(id, { status: "AVAILABLE", locked_by: null });
      }
    }
  });

  // Client-side session expiry check (runs every tick)
  const sessionRemaining = sessionTtl && grantedAt
    ? Math.max(0, Math.floor(grantedAt + sessionTtl - Date.now() / 1000))
    : null;

  useEffect(() => {
    if (sessionRemaining !== null && sessionRemaining <= 0 && !sessionExpired) {
      setSessionExpired(true);
    }
  }, [sessionRemaining, sessionExpired]);

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
          removeLockTime(seat.id);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Failed to release seat");
        }
        return;
      }
      try {
        const res = await lock.mutateAsync(seat.id);
        applyUpdate(seat.id, { status: "LOCKED", locked_by: user.id });
        toggleSelect(seat.id);
        // Store server locked_at for countdown.
        if (res.locked_at) {
          setLockTime(seat.id, res.locked_at);
        }
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
      removeLockTime,
      selectedIds,
      setLockTime,
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
      goingToCheckout.current = true;
      navigate(`/checkout/${booking.id}`);
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Unable to create booking"),
  });

  const event = eventQ.data;
  // Show loading only when there's truly no data — not even stale data in the
  // Zustand store from before navigation.  This eliminates the 0.5 s flash
  // when pressing browser-back from checkout.
  const loading =
    !queueChecked || eventQ.isLoading || (seatsQ.isLoading && seatsArray.length === 0);

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
          {/* Session countdown banner */}
          {sessionRemaining !== null && (
            <div className={`session-countdown-banner lg:col-span-2 ${sessionRemaining <= 120 ? "urgent" : ""}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Session time remaining:</span>
              <span className="session-countdown-time">
                {formatCountdown(sessionRemaining)}
              </span>
              {sessionRemaining <= 120 && (
                <span className="session-countdown-warning">Hurry up!</span>
              )}
            </div>
          )}

          <section
            className="rounded-2xl border p-3 shadow-sm"
            style={{
              borderColor: "var(--border-primary)",
              background: "var(--bg-secondary)",
            }}
          >
            <SeatCanvas
              seats={seatsArray}
              rows={event.venue.grid_rows}
              cols={event.venue.grid_cols}
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
                Each seat is held for {SEAT_LOCK_TTL}s while you check out.
              </p>
            </div>
            {selected.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Tap a seat to select it.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {selected.map((s) => {
                  const lockedAt = lockTimers[s.id];
                  const remaining = lockedAt
                    ? getRemainingSeconds(lockedAt)
                    : SEAT_LOCK_TTL;
                  const urgent = remaining <= 15;
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                      style={{
                        borderColor: urgent
                          ? "var(--danger)"
                          : "var(--border-primary)",
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
                      <span className="flex items-center gap-3">
                        <span
                          className="font-mono text-xs tabular-nums"
                          style={{
                            color: urgent ? "var(--danger)" : "var(--text-muted)",
                          }}
                        >
                          {formatCountdown(remaining)}
                        </span>
                        <span
                          className="font-semibold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {formatCurrency(s.price ?? "0")}
                        </span>
                      </span>
                    </li>
                  );
                })}
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
