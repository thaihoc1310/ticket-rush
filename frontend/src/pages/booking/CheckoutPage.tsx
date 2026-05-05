import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { LED } from "@/components/ui/Badge";
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
      setError(
        err instanceof ApiError ? err.message : "Failed to cancel booking"
      ),
  });

  if (bookingQ.isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="card animate-pulse p-8">
          <div className="h-4 w-32 rounded bg-[var(--muted)]" />
          <div className="mt-4 h-8 w-2/3 rounded bg-[var(--muted)]" />
          <div className="mt-2 h-4 w-1/3 rounded bg-[var(--muted)]" />
        </div>
      </div>
    );
  }

  if (bookingQ.error || !bookingQ.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="card card-screws p-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger-bg)]">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--danger)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          </div>
          <p className="font-semibold text-[var(--text-primary)]">
            Booking not found
          </p>
          <Link
            to="/"
            className="mt-4 inline-block text-sm font-semibold text-[var(--accent)] transition hover:text-[var(--accent-hover)]"
          >
            Back to events
          </Link>
        </div>
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
      {/* Header */}
      <header className="card p-6">
        <button
          type="button"
          onClick={() => {
            if (!canGoBack) {
              navigate(`/events/${booking.event_id}/book`);
              return;
            }
            if (
              confirm(
                "Go back and re-pick your seats? Your current hold will be released."
              )
            ) {
              cancel.mutate();
            }
          }}
          disabled={cancel.isPending}
          className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--accent)] transition hover:text-[var(--accent-hover)] disabled:opacity-60"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          {canGoBack ? "Change my seats" : "Back to seat selection"}
        </button>

        <div className="flex items-center gap-2">
          <LED status="accent" size="sm" />
          <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Checkout
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-extrabold text-[var(--text-primary)]">
          {booking.event_title}
        </h1>
        <p className="mt-1 font-mono text-sm text-[var(--text-muted)]">
          {formatDateTime(booking.event_date)}
        </p>
      </header>

      {/* Countdown Timer */}
      <section
        className={`card p-6 text-center ${
          expired
            ? "bg-[var(--danger-bg)]"
            : remaining < 60_000
              ? "bg-[var(--warning-bg)]"
              : ""
        }`}
        style={{
          boxShadow: expired
            ? "inset 0 0 0 2px var(--danger)"
            : remaining < 60_000
              ? "inset 0 0 0 2px var(--warning)"
              : "var(--shadow-card)",
        }}
      >
        <div className="flex items-center justify-center gap-2">
          <LED
            status={expired ? "danger" : remaining < 60_000 ? "warning" : "accent"}
            size="md"
          />
          <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Hold expires in
          </span>
        </div>
        <p className="mt-2 font-mono text-5xl font-extrabold tabular-nums text-[var(--text-primary)]">
          {formatCountdown(remaining)}
        </p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Do not refresh — seats are held for you.
        </p>
      </section>

      {/* Order Summary */}
      <section className="card card-screws p-6">
        <h2 className="mb-4 text-lg font-bold text-[var(--text-primary)]">
          Order Summary
        </h2>
        <ul className="flex flex-col gap-2">
          {booking.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-lg bg-[var(--muted)] p-3 shadow-[var(--shadow-recessed)]"
            >
              <span className="text-sm text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text-primary)]">
                  {item.zone_name}
                </span>{" "}
                · Row {item.row_number}, Seat {item.seat_number}
              </span>
              <span className="font-mono font-bold text-[var(--text-primary)]">
                {formatCurrency(item.price)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t-2 border-[var(--muted)] pt-4">
          <span className="font-mono text-sm uppercase tracking-wider text-[var(--text-muted)]">
            Total
          </span>
          <span className="font-mono text-2xl font-extrabold text-[var(--accent)]">
            {formatCurrency(booking.total_amount)}
          </span>
        </div>
      </section>

      {/* Payment Actions */}
      {booking.status === "CONFIRMED" ? (
        <Link
          to={`/confirmation/${booking.id}`}
          className="btn btn-primary text-center"
        >
          View Confirmation
        </Link>
      ) : booking.status === "EXPIRED" || expired ? (
        <div className="card bg-[var(--danger-bg)] p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger)]">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" x2="9" y1="9" y2="15" />
              <line x1="9" x2="15" y1="9" y2="15" />
            </svg>
          </div>
          <p className="font-semibold text-[var(--danger)]">
            Your hold has expired
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Please start over and select your seats again.
          </p>
          <Link
            to={`/events/${booking.event_id}/book`}
            className="btn btn-secondary btn-inline mt-4"
          >
            Back to Seat Selection
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-3 rounded-lg bg-[var(--danger-bg)] p-4">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--danger)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
              <p className="text-sm font-medium text-[var(--danger)]">{error}</p>
            </div>
          )}
          <Button
            onClick={() => pay.mutate()}
            loading={pay.isPending}
            disabled={!canPay}
            fullWidth
          >
            Confirm Payment (Simulated)
          </Button>
          <p className="text-center font-mono text-[0.6875rem] text-[var(--text-muted)]">
            Payment is simulated — clicking confirm marks the booking paid and
            issues QR tickets.
          </p>
        </div>
      )}
    </div>
  );
}
