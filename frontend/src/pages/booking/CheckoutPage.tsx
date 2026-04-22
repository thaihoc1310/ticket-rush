import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ApiError, bookingApi } from "@/services/api";
import { formatCurrency, formatDateTime } from "@/utils/format";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CheckoutPage() {
  const { bookingId = "" } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const bookingQ = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => bookingApi.get(bookingId),
    enabled: Boolean(bookingId),
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const pay = useMutation({
    mutationFn: () => bookingApi.pay(bookingId),
    onSuccess: () => navigate(`/confirmation/${bookingId}`),
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Payment failed"),
  });

  const cancel = useMutation({
    mutationFn: () => bookingApi.cancel(bookingId),
    onSuccess: (booking) => {
      navigate(`/events/${booking.event_id}/book`, { replace: true });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Failed to cancel booking"),
  });

  if (bookingQ.isLoading) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Loading…
      </p>
    );
  }
  if (bookingQ.error || !bookingQ.data) {
    return (
      <div
        className="rounded-2xl border border-dashed p-10 text-center text-sm"
        style={{
          borderColor: "var(--border-primary)",
          background: "var(--bg-secondary)",
          color: "var(--text-muted)",
        }}
      >
        Booking not found.{" "}
        <Link to="/" style={{ color: "var(--accent)" }}>
          Back to events
        </Link>
      </div>
    );
  }

  const booking = bookingQ.data;
  const expiresAt = new Date(booking.expires_at).getTime();
  const remaining = expiresAt - now;
  const expired = remaining <= 0;
  const canPay =
    booking.status === "PENDING" && !expired && pay.isPending === false;

  const canGoBack = booking.status === "PENDING" && !expired;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <button
          type="button"
          onClick={() => {
            if (!canGoBack) {
              navigate(`/events/${booking.event_id}/book`);
              return;
            }
            if (
              confirm(
                "Go back and re-pick your seats? Your current hold will be released.",
              )
            ) {
              cancel.mutate();
            }
          }}
          disabled={cancel.isPending}
          className="text-sm hover:opacity-80 disabled:opacity-60"
          style={{ color: "var(--accent)" }}
        >
          ← {canGoBack ? "Change my seats" : "Back to seat selection"}
        </button>
        <p
          className="mt-2 text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Checkout
        </p>
        <h1
          className="mt-1 text-2xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {booking.event_title}
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {formatDateTime(booking.event_date)}
        </p>
      </header>

      <section
        className="rounded-2xl border p-5 text-center shadow-sm"
        style={{
          borderColor: expired
            ? "var(--danger)"
            : remaining < 60_000
              ? "var(--warning)"
              : "var(--accent)",
          background: expired
            ? "var(--danger-bg)"
            : remaining < 60_000
              ? "var(--warning-bg)"
              : "var(--accent-subtle)",
        }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-secondary)" }}
        >
          Hold expires in
        </p>
        <p
          className="mt-1 text-4xl font-bold tabular-nums"
          style={{ color: "var(--text-primary)" }}
        >
          {formatCountdown(remaining)}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Do not refresh — seats are held for you.
        </p>
      </section>

      <section
        className="rounded-2xl border p-6 shadow-sm"
        style={{
          borderColor: "var(--border-primary)",
          background: "var(--bg-secondary)",
        }}
      >
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Order summary
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {booking.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
              style={{
                borderColor: "var(--border-primary)",
                color: "var(--text-secondary)",
              }}
            >
              <span>
                {item.zone_name} · R{item.row_number} S{item.seat_number}
              </span>
              <span
                className="font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {formatCurrency(item.price)}
              </span>
            </li>
          ))}
        </ul>
        <div
          className="mt-4 flex items-center justify-between border-t pt-4 text-sm"
          style={{ borderColor: "var(--border-primary)" }}
        >
          <span style={{ color: "var(--text-muted)" }}>Total</span>
          <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            {formatCurrency(booking.total_amount)}
          </span>
        </div>
      </section>

      {booking.status === "CONFIRMED" ? (
        <Link
          to={`/confirmation/${booking.id}`}
          className="rounded-md px-4 py-2 text-center text-sm font-semibold text-white"
          style={{ background: "var(--success)" }}
        >
          View confirmation
        </Link>
      ) : booking.status === "EXPIRED" || expired ? (
        <div
          className="rounded-md p-4 text-center text-sm"
          style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
        >
          Your hold has expired. Please start over.
          <div className="mt-3">
            <Link
              to={`/events/${booking.event_id}/book`}
              className="inline-block rounded-md border px-3 py-1.5 font-medium hover:opacity-90"
              style={{
                borderColor: "var(--danger)",
                color: "var(--danger)",
              }}
            >
              Back to seat selection
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {error && (
            <p
              className="rounded-md px-3 py-2 text-sm"
              style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
            >
              {error}
            </p>
          )}
          <Button
            onClick={() => pay.mutate()}
            loading={pay.isPending}
            disabled={!canPay}
          >
            Confirm payment (simulated)
          </Button>
          <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Payment is simulated — clicking confirm marks the booking paid and
            issues QR tickets.
          </p>
        </div>
      )}
    </div>
  );
}
