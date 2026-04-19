import { useQuery } from "@tanstack/react-query";

import { ticketApi } from "@/services/api";
import { formatDateTime } from "@/utils/format";

export function MyTicketsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tickets", "my"],
    queryFn: ticketApi.listMine,
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-100">My tickets</h1>
        <p className="text-sm text-gray-500">
          Keep these QR codes handy — you'll scan them at the venue entrance.
        </p>
      </header>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && (
        <p className="text-sm text-red-400">Unable to load tickets.</p>
      )}
      {data && data.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-900 p-10 text-center text-gray-500">
          You don't have any tickets yet.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {data?.map((ticket) => (
          <article
            key={ticket.id}
            className="flex items-center gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-5 shadow-sm"
          >
            <img
              src={ticket.qr_image}
              alt={`QR for ${ticket.event_title}`}
              className="h-28 w-28 rounded-md border border-gray-700 bg-white"
            />
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                {ticket.status}
              </span>
              <span className="text-base font-semibold text-gray-100">
                {ticket.event_title}
              </span>
              <span className="text-gray-400">
                {formatDateTime(ticket.event_date)}
              </span>
              <span className="text-gray-400">
                {ticket.zone_name} · Row {ticket.row_number} · Seat{" "}
                {ticket.seat_number}
              </span>
              <span className="mt-1 text-xs text-gray-600 break-all">
                {ticket.qr_data}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
