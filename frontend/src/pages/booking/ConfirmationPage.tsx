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
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (bookingQ.error || !bookingQ.data) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        Booking not found.
      </div>
    );
  }
  const booking = bookingQ.data;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
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
        <h1 className="text-2xl font-semibold text-slate-900">Booking confirmed!</h1>
        <p className="mt-1 text-sm text-slate-600">
          {booking.event_title} · {formatDateTime(booking.event_date)}
        </p>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-white p-5 text-left shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Your seats
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {booking.items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>
                {item.zone_name} · R{item.row_number} S{item.seat_number}
              </span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(item.price)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm">
          <span className="text-slate-500">Paid</span>
          <span className="text-base font-bold text-slate-900">
            {formatCurrency(booking.total_amount)}
          </span>
        </div>
      </div>
      <Link
        to="/tickets"
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        View my tickets
      </Link>
    </div>
  );
}
