import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ticketApi } from "@/services/api";
import type { Ticket } from "@/types/booking";
import { formatCurrency, formatDateTime } from "@/utils/format";

export function MyTicketsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tickets", "my"],
    queryFn: ticketApi.listMine,
  });

  // Group tickets by event_id
  const groupedEvents = useMemo(() => {
    if (!data) return [];
    
    const groups = new Map<string, { event_title: string; event_status: string; event_date: string; venue_name: string; venue_address: string; tickets: Ticket[] }>();
    
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
    
    // Preserve backend's issued_at.desc() order (most recently purchased first)
    return Array.from(groups.entries()).map(([event_id, info]) => ({
      event_id,
      ...info,
    }));
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

      <div className="flex flex-col gap-4">
        {groupedEvents.map((group) => {
          const isExpanded = expanded.has(group.event_id);
          
          return (
            <div 
              key={group.event_id} 
              className="flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-all"
              style={{
                borderColor: "var(--border-primary)",
                background: "var(--bg-secondary)",
              }}
            >
              {/* Accordion Header */}
              <button
                type="button"
                className="flex flex-col gap-4 p-5 text-left transition-colors hover:bg-black/5 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-white/5"
                onClick={() => toggleExpand(group.event_id)}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xl font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {group.event_title}
                    </span>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      group.event_status === 'PUBLISHED' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                      group.event_status === 'ENDED' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' :
                      'bg-slate-500/15 text-slate-600 dark:text-slate-400'
                    }`}>
                      {group.event_status}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 text-sm sm:flex-row sm:items-center sm:gap-3" style={{ color: "var(--text-secondary)" }}>
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon />
                      {formatDateTime(group.event_date)}
                    </span>
                    <span className="hidden sm:inline" style={{ color: "var(--border-primary)" }}>|</span>
                    <span className="flex items-center gap-1.5">
                      <MapPinIcon />
                      {group.venue_name}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <span className="rounded-full px-3 py-1 text-sm font-medium" style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }}>
                    {group.tickets.length} ticket{group.tickets.length !== 1 ? 's' : ''}
                  </span>
                  <svg 
                    width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                    style={{ color: "var(--text-muted)" }}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </button>

              {/* Accordion Body */}
              {isExpanded && (
                <div 
                  className="grid gap-4 border-t p-5 xl:grid-cols-2"
                  style={{ borderColor: "var(--border-primary)" }}
                >
                  {group.tickets.map((ticket) => (
                    <article
                      key={ticket.id}
                      className="flex items-start sm:items-center gap-4 rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md"
                      style={{
                        borderColor: "var(--border-primary)",
                        background: "var(--bg-primary)",
                      }}
                    >
                      <img
                        src={ticket.qr_image}
                        alt={`QR for ${ticket.event_title}`}
                        className="h-28 w-28 shrink-0 rounded-lg border bg-white p-1.5"
                        style={{ borderColor: "var(--border-primary)" }}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                            style={{ 
                              background: "color-mix(in srgb, var(--text-primary) 8%, transparent)",
                              color: "var(--text-primary)"
                            }}
                          >
                            {ticket.zone_name}
                          </span>
                          <span
                            className="text-xs font-medium font-mono"
                            style={{ color: "var(--text-muted)" }}
                          >
                            #{ticket.id.split('-')[0].toUpperCase()}
                          </span>
                        </div>
                        
                        <div className="flex flex-col">
                          <span className="text-lg font-extrabold" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                            Row {ticket.row_number} · Seat {ticket.seat_number}
                          </span>
                          <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                            {formatCurrency(ticket.price)}
                          </span>
                        </div>
                        
                        <div className="mt-1 flex items-center justify-between gap-2">
                           <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              ticket.status === 'VALID' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                              ticket.status === 'USED' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                              'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                           }`}>
                             {ticket.status}
                           </span>
                           <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                             Purchased: {formatDateTime(ticket.issued_at)}
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

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3"></circle>
    </svg>
  );
}
