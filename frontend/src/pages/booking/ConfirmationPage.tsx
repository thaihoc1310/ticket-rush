import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { LED } from "@/components/ui/Badge";
import { bookingApi } from "@/services/api";
import { formatCurrency, formatDateTime } from "@/utils/format";

export function ConfirmationPage() {
  const { bookingId = "" } = useParams<{ bookingId: string }>();
  const bookingQ = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => bookingApi.get(bookingId),
    enabled: Boolean(bookingId),
  });

  if (bookingQ.isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card animate-pulse p-8 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-[var(--muted)]" />
          <div className="mx-auto mt-4 h-8 w-48 rounded bg-[var(--muted)]" />
          <div className="mx-auto mt-2 h-4 w-32 rounded bg-[var(--muted)]" />
        </div>
      </div>
    );
  }

  if (bookingQ.error || !bookingQ.data) {
    return (
      <div className="mx-auto max-w-2xl">
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
        </div>
      </div>
    );
  }

  const booking = bookingQ.data;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {/* Success Card */}
      <div className="card card-screws overflow-hidden p-0">
        {/* Success Header */}
        <div className="bg-[var(--success)] p-8 text-center text-white">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 shadow-lg">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="h-8 w-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold">Booking Confirmed!</h1>
          <p className="mt-2 text-sm opacity-90">
            Your tickets have been issued successfully.
          </p>
        </div>

        {/* Event Details */}
        <div className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <LED status="success" size="sm" />
            <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Confirmed
            </span>
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {booking.event_title}
          </h2>
          <p className="mt-1 font-mono text-sm text-[var(--text-muted)]">
            {formatDateTime(booking.event_date)}
          </p>
        </div>

        {/* Seats Summary */}
        <div className="border-t-2 border-[var(--muted)] p-6">
          <p className="mb-3 font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Your Seats
          </p>
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
              Total Paid
            </span>
            <span className="font-mono text-2xl font-extrabold text-[var(--success)]">
              {formatCurrency(booking.total_amount)}
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <Link to="/tickets" className="btn btn-primary text-center">
        View My Tickets
      </Link>

      {/* Info */}
      <p className="text-center font-mono text-[0.6875rem] text-[var(--text-muted)]">
        A confirmation email has been sent. Your QR tickets are ready in "My
        Tickets".
      </p>
    </div>
  );
}
