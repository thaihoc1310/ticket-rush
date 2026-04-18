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
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (bookingQ.error || !bookingQ.data) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        Booking not found.{" "}
        <Link to="/" className="text-indigo-600">
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
          className="text-sm text-indigo-600 hover:text-indigo-500 disabled:opacity-60"
        >
          ← {canGoBack ? "Change my seats" : "Back to seat selection"}
        </button>
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Checkout
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {booking.event_title}
        </h1>
        <p className="text-sm text-slate-500">
          {formatDateTime(booking.event_date)}
        </p>
      </header>

      <section
        className={`rounded-2xl border p-5 text-center shadow-sm ${
          expired
            ? "border-red-200 bg-red-50"
            : remaining < 60_000
              ? "border-amber-200 bg-amber-50"
              : "border-indigo-200 bg-indigo-50"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Hold expires in
        </p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">
          {formatCountdown(remaining)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Do not refresh — seats are held for you.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Order summary</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {booking.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
            >
              <span>
                {item.zone_name} · R{item.row_number} S{item.seat_number}
              </span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(item.price)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-sm">
          <span className="text-slate-500">Total</span>
          <span className="text-xl font-bold text-slate-900">
            {formatCurrency(booking.total_amount)}
          </span>
        </div>
      </section>

      {booking.status === "CONFIRMED" ? (
        <Link
          to={`/confirmation/${booking.id}`}
          className="rounded-md bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-500"
        >
          View confirmation
        </Link>
      ) : booking.status === "EXPIRED" || expired ? (
        <div className="rounded-md bg-red-50 p-4 text-center text-sm text-red-700">
          Your hold has expired. Please start over.
          <div className="mt-3">
            <Link
              to={`/events/${booking.event_id}/book`}
              className="inline-block rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
            >
              Back to seat selection
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
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
          <p className="text-center text-xs text-slate-500">
            Payment is simulated — clicking confirm marks the booking paid and
            issues QR tickets.
          </p>
        </div>
      )}
    </div>
  );
}
