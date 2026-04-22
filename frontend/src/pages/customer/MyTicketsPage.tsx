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
        <h1
          className="text-2xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          My tickets
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Keep these QR codes handy — you'll scan them at the venue entrance.
        </p>
      </header>

      {isLoading && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Loading…
        </p>
      )}
      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          Unable to load tickets.
        </p>
      )}
      {data && data.length === 0 && (
        <div
          className="rounded-2xl border border-dashed p-10 text-center text-sm"
          style={{
            borderColor: "var(--border-primary)",
            background: "var(--bg-secondary)",
            color: "var(--text-muted)",
          }}
        >
          You don't have any tickets yet.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {data?.map((ticket) => (
          <article
            key={ticket.id}
            className="flex items-center gap-4 rounded-2xl border p-5 shadow-sm"
            style={{
              borderColor: "var(--border-primary)",
              background: "var(--bg-secondary)",
            }}
          >
            <img
              src={ticket.qr_image}
              alt={`QR for ${ticket.event_title}`}
              className="h-28 w-28 rounded-md border bg-white"
              style={{ borderColor: "var(--border-primary)" }}
            />
            <div className="flex flex-col gap-1 text-sm">
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}
              >
                {ticket.status}
              </span>
              <span
                className="text-base font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {ticket.event_title}
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                {formatDateTime(ticket.event_date)}
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                {ticket.zone_name} · Row {ticket.row_number} · Seat{" "}
                {ticket.seat_number}
              </span>
              <span
                className="mt-1 break-all text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {ticket.qr_data}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
