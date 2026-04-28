import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { FilterModal, defaultFilter, type FilterState } from "@/components/FilterModal";
import { eventApi } from "@/services/api";
import type { EventListQuery, EventSummary } from "@/types/catalog";
import { formatDateTime } from "@/utils/format";

function mainImageUrl(event: EventSummary): string | null {
  if (event.images?.length) {
    const main = event.images.find((i) => i.is_main) ?? event.images[0];
    return main?.image_url ?? null;
  }
  return event.banner_url;
}

function countActive(state: FilterState, meta: { min_price: number; max_price: number } | undefined): number {
  let n = 0;
  if (state.dateRange.startDate || state.dateRange.endDate) n++;
  if (meta && (state.priceRange.min > meta.min_price || state.priceRange.max < meta.max_price)) n++;
  if (state.locations.length) n++;
  if (state.categories.length) n++;
  if (state.status) n++;
  return n;
}

export function EventListPage() {
  const [q, setQ] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  // Fetch filter metadata (price bounds, cities, categories)
  const metaQ = useQuery({
    queryKey: ["events", "filter-meta"],
    queryFn: eventApi.filterMeta,
    staleTime: 60_000,
  });
  const meta = metaQ.data;

  const [filters, setFilters] = useState<FilterState>(() => defaultFilter(meta));

  // Sync price range when meta first arrives
  useEffect(() => {
    if (meta) {
      setFilters((prev) => ({
        ...prev,
        priceRange: {
          min: prev.priceRange.min === 0 ? meta.min_price : prev.priceRange.min,
          max: prev.priceRange.max === 1000 ? meta.max_price : prev.priceRange.max,
        },
      }));
    }
  }, [meta]);

  // Build query object from search + applied filters
  const query: EventListQuery = useMemo(() => {
    const out: EventListQuery = {};
    const search = q.trim();
    if (search) out.q = search;
    if (filters.status) out.status = filters.status;
    if (filters.dateRange.startDate) out.date_from = new Date(filters.dateRange.startDate + "T00:00:00").toISOString();
    if (filters.dateRange.endDate) out.date_to = new Date(filters.dateRange.endDate + "T23:59:59").toISOString();
    if (filters.locations.length) out.cities = filters.locations.join(",");
    if (filters.categories.length) out.categories = filters.categories.join(",");
    if (meta) {
      if (filters.priceRange.min > meta.min_price) out.price_min = filters.priceRange.min;
      if (filters.priceRange.max < meta.max_price) out.price_max = filters.priceRange.max;
    }
    return out;
  }, [q, filters, meta]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", query],
    queryFn: () => eventApi.list(query),
  });

  const [showPromo, setShowPromo] = useState(false);
  const [promoEvent, setPromoEvent] = useState<{ id: string; img: string } | null>(null);

  useEffect(() => {
    if (data && data.length > 0) {
      const hasSeen = sessionStorage.getItem("hasSeenPromo");
      if (!hasSeen) {
        const eventsWithImage = data
          .map((e) => ({ id: e.id, img: mainImageUrl(e) }))
          .filter((e) => e.img !== null) as { id: string; img: string }[];
        
        if (eventsWithImage.length > 0) {
          const randomIndex = Math.floor(Math.random() * eventsWithImage.length);
          setPromoEvent(eventsWithImage[randomIndex]);
          setShowPromo(true);
        }
        sessionStorage.setItem("hasSeenPromo", "true");
      }
    }
  }, [data]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Hero ── */}
      <section className="hero-gradient rounded-3xl px-8 py-12 shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-widest opacity-80">
          TicketRush
        </p>
        <h1 className="mt-2 text-4xl font-bold leading-tight sm:text-5xl">
          Snag the best seats without the chaos.
        </h1>
        <p className="mt-3 max-w-xl opacity-90">
          Real-time seating maps, fair queues, and lightning-fast checkout.
        </p>
      </section>

      {/* ── Search + Filter trigger ── */}
      <div className="event-search-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search concerts, festivals, artists…"
          className="input-field"
        />
        <button
          type="button"
          id="filter-trigger"
          className="filter-trigger-btn"
          onClick={() => setFilterOpen(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" />
          </svg>
          Filters
          {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
        </button>
      </div>

      {/* ── Filter Modal ── */}
      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={setFilters}
        meta={meta}
        initial={filters}
      />

      {/* ── Event grid ── */}
      <section>
        {isLoading && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading events…
          </p>
        )}
        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            Failed to load events. Please retry.
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
            No events match your filters.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((event) => {
            const img = mainImageUrl(event);
            return (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5"
                style={{
                  borderColor: "var(--border-primary)",
                  background: "var(--bg-secondary)",
                }}
              >
                <div
                  className="h-40 w-full bg-cover bg-center"
                  style={
                    img
                      ? {
                          backgroundImage: `url(${img})`,
                        }
                      : {
                          background:
                            "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)",
                        }
                  }
                />
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <div
                    className="flex items-center justify-between text-xs font-medium uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span>{event.venue.city}</span>
                    <span
                      className={`badge ${
                        event.status === "PUBLISHED"
                          ? "badge-success"
                          : event.status === "ENDED"
                            ? "badge-muted"
                            : "badge-warning"
                      }`}
                    >
                      {event.status}
                    </span>
                  </div>
                  <h3
                    className="text-lg font-semibold transition group-hover:text-[color:var(--accent)]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {event.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {event.venue.name}
                    </p>
                    {event.category && (
                      <span className="badge badge-accent">{event.category}</span>
                    )}
                  </div>
                  <p
                    className="mt-auto text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatDateTime(event.event_date)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {showPromo && promoEvent && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setShowPromo(false)}
        >
          <div 
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="absolute -right-2 -top-12 p-2 text-white transition hover:text-gray-300"
              onClick={() => setShowPromo(false)}
              aria-label="Close"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <Link 
              to={`/events/${promoEvent.id}`} 
              className="block overflow-hidden rounded-2xl shadow-2xl transition hover:scale-[1.01]"
            >
              <img 
                src={promoEvent.img} 
                alt="Promo Event" 
                className="max-h-[85vh] w-full object-contain"
                style={{ background: "rgba(0,0,0,0.5)" }}
              />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
