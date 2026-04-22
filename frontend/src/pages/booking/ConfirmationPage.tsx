import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

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
        Booking not found.
      </div>
    );
  }
  const booking = bookingQ.data;

  return (
    <div
      className="mx-auto flex max-w-2xl flex-col gap-6 rounded-2xl border p-8 text-center shadow-sm"
      style={{
        borderColor: "var(--success)",
        background: "var(--success-bg)",
      }}
    >
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white shadow"
        style={{ background: "var(--success)" }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-7 w-7"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <div>
        <h1
          className="text-2xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Booking confirmed!
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          {booking.event_title} · {formatDateTime(booking.event_date)}
        </p>
      </div>
      <div
        className="rounded-xl border p-5 text-left shadow-sm"
        style={{
          borderColor: "var(--border-primary)",
          background: "var(--bg-secondary)",
        }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Your seats
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {booking.items.map((item) => (
            <li
              key={item.id}
              className="flex justify-between"
              style={{ color: "var(--text-secondary)" }}
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
          className="mt-3 flex justify-between border-t pt-3 text-sm"
          style={{ borderColor: "var(--border-primary)" }}
        >
          <span style={{ color: "var(--text-muted)" }}>Paid</span>
          <span
            className="text-base font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {formatCurrency(booking.total_amount)}
          </span>
        </div>
      </div>
      <Link to="/tickets" className="btn btn-primary">
        View my tickets
      </Link>
    </div>
  );
}
