import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Badge, LED } from "@/components/ui/Badge";
import { ticketApi } from "@/services/api";
import type { Ticket } from "@/types/booking";
import { formatCurrency, formatDateTime } from "@/utils/format";

export function MyTicketsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tickets", "my"],
    queryFn: ticketApi.listMine,
  });

  const groupedEvents = useMemo(() => {
    if (!data) return [];

    const groups = new Map<
      string,
      {
        event_title: string;
        event_status: string;
        event_date: string;
        venue_name: string;
        venue_address: string;
        tickets: Ticket[];
      }
    >();

    for (const ticket of data) {
      if (!groups.has(ticket.event_id)) {
        groups.set(ticket.event_id, {
          event_title: ticket.event_title,
          event_status: ticket.event_status,
          event_date: ticket.event_date,
          venue_name: ticket.venue_name,
          venue_address: ticket.venue_address,
          tickets: [],
        });
      }
      groups.get(ticket.event_id)!.tickets.push(ticket);
    }

    return Array.from(groups.entries())
      .map(([event_id, info]) => ({
        event_id,
        ...info,
      }))
      .sort((a, b) => {
        const maxA = Math.max(...a.tickets.map((t) => new Date(t.issued_at).getTime()));
        const maxB = Math.max(...b.tickets.map((t) => new Date(t.issued_at).getTime()));
        return maxB - maxA;
      });
  }, [data]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (eventId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="card p-6">
        <div className="mb-2 flex items-center gap-2">
          <LED status="accent" size="sm" />
          <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Ticket Wallet
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">
          My Tickets
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Keep these QR codes handy — you'll scan them at the venue entrance.
        </p>
      </header>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card animate-pulse p-6">
              <div className="h-6 w-1/2 rounded bg-[var(--muted)]" />
              <div className="mt-2 h-4 w-1/3 rounded bg-[var(--muted)]" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="card card-screws p-8 text-center">
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
            Unable to load tickets
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Please try again later.
          </p>
        </div>
      )}

      {/* Empty State */}
      {data && data.length === 0 && (
        <div className="card card-screws p-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--muted)] shadow-[var(--shadow-recessed)]">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              <path d="M13 5v2" />
              <path d="M13 17v2" />
              <path d="M13 11v2" />
            </svg>
          </div>
          <p className="font-semibold text-[var(--text-primary)]">
            No tickets yet
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Your purchased tickets will appear here.
          </p>
        </div>
      )}

      {/* Ticket Groups */}
      <div className="flex flex-col gap-4">
        {groupedEvents.map((group) => {
          const isExpanded = expanded.has(group.event_id);

          return (
            <div
              key={group.event_id}
              className="card card-screws overflow-hidden p-0"
            >
              {/* Accordion Header */}
              <button
                type="button"
                className="flex w-full flex-col gap-4 p-5 text-left transition-colors hover:bg-[var(--muted)]/50 sm:flex-row sm:items-center sm:justify-between"
                onClick={() => toggleExpand(group.event_id)}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-[var(--text-primary)]">
                      {group.event_title}
                    </span>
                    <Badge
                      variant={
                        group.event_status === "PUBLISHED"
                          ? "success"
                          : group.event_status === "ENDED"
                            ? "danger"
                            : "muted"
                      }
                      led
                    >
                      {group.event_status}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1.5 text-sm text-[var(--text-muted)] sm:flex-row sm:items-center sm:gap-3">
                    <span className="flex items-center gap-1.5">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-70"
                      >
                        <rect
                          x="3"
                          y="4"
                          width="18"
                          height="18"
                          rx="2"
                          ry="2"
                        />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span className="font-mono text-xs">
                        {formatDateTime(group.event_date)}
                      </span>
                    </span>
                    <span className="hidden text-[var(--muted)] sm:inline">
                      |
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-70"
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {group.venue_name}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span className="badge badge-accent">
                    {group.tickets.length} ticket
                    {group.tickets.length !== 1 ? "s" : ""}
                  </span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-[var(--text-muted)] transition-transform duration-300 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Accordion Body */}
              {isExpanded && (
                <div className="grid gap-4 border-t-2 border-[var(--muted)] p-5 xl:grid-cols-2">
                  {group.tickets.map((ticket) => (
                    <article
                      key={ticket.id}
                      className="flex items-start gap-4 rounded-xl bg-[var(--muted)] p-4 shadow-[var(--shadow-recessed)] transition-shadow hover:shadow-[var(--shadow-card)] sm:items-center"
                    >
                      <img
                        src={ticket.qr_image}
                        alt={`QR for ${ticket.event_title}`}
                        className="h-28 w-28 shrink-0 rounded-lg bg-white p-2 shadow-[var(--shadow-sharp)]"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="rounded-md bg-[var(--dark-panel)] px-2 py-0.5 font-mono text-[0.625rem] font-bold uppercase tracking-wider text-white">
                            {ticket.zone_name}
                          </span>
                          <span className="font-mono text-[0.6875rem] text-[var(--text-muted)]">
                            #{ticket.id.split("-")[0].toUpperCase()}
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
                            Row {ticket.row_number} · Seat {ticket.seat_number}
                          </span>
                          <span className="font-mono text-sm font-bold text-[var(--accent)]">
                            {formatCurrency(ticket.price)}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center justify-between gap-2">
                          <Badge
                            variant={
                              ticket.status === "VALID"
                                ? "success"
                                : ticket.status === "USED"
                                  ? "warning"
                                  : "danger"
                            }
                            led
                          >
                            {ticket.status}
                          </Badge>
                          <span className="font-mono text-[0.625rem] text-[var(--text-muted)]">
                            {formatDateTime(ticket.issued_at)}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
