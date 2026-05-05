import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge, LED } from "@/components/ui/Badge";
import {
  FilterModal,
  defaultFilter,
  type FilterState,
} from "@/components/FilterModal";
import { eventApi } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import type { EventListQuery, EventSummary } from "@/types/catalog";
import { formatDateTime } from "@/utils/format";

const mechanicalEase = [0.175, 0.885, 0.32, 1.275] as const;

function mainImageUrl(event: EventSummary): string | null {
  if (event.images?.length) {
    const main = event.images.find((i) => i.is_main) ?? event.images[0];
    return main?.image_url ?? null;
  }
  return event.banner_url;
}

function countActive(
  state: FilterState,
  meta: { min_price: number; max_price: number } | undefined
): number {
  let n = 0;
  if (state.dateRange.startDate || state.dateRange.endDate) n++;
  if (
    meta &&
    (state.priceRange.min > meta.min_price ||
      state.priceRange.max < meta.max_price)
  )
    n++;
  if (state.locations.length) n++;
  if (state.categories.length) n++;
  if (state.status) n++;
  return n;
}

export function EventListPage() {
  const [q, setQ] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const metaQ = useQuery({
    queryKey: ["events", "filter-meta"],
    queryFn: eventApi.filterMeta,
    staleTime: 60_000,
  });
  const meta = metaQ.data;

  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "ADMIN";

  const [filters, setFilters] = useState<FilterState>(() =>
    defaultFilter(meta, isAdmin)
  );

  const activeCount = useMemo(() => countActive(filters, meta), [filters, meta]);

  useEffect(() => {
    if (meta) {
      setFilters((prev) => ({
        ...prev,
        priceRange: {
          min: prev.priceRange.min === 0 ? meta.min_price : prev.priceRange.min,
          max:
            prev.priceRange.max === 1000 ? meta.max_price : prev.priceRange.max,
        },
      }));
    }
  }, [meta]);

  const query: EventListQuery = useMemo(() => {
    const out: EventListQuery = {};
    const search = q.trim();
    if (search) out.q = search;
    if (filters.status) out.status = filters.status;
    if (filters.dateRange.startDate)
      out.date_from = new Date(
        filters.dateRange.startDate + "T00:00:00"
      ).toISOString();
    if (filters.dateRange.endDate)
      out.date_to = new Date(
        filters.dateRange.endDate + "T23:59:59"
      ).toISOString();
    if (filters.locations.length) out.cities = filters.locations.join(",");
    if (filters.categories.length) out.categories = filters.categories.join(",");
    if (meta) {
      if (filters.priceRange.min > meta.min_price)
        out.price_min = filters.priceRange.min;
      if (filters.priceRange.max < meta.max_price)
        out.price_max = filters.priceRange.max;
    }
    return out;
  }, [q, filters, meta]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", query],
    queryFn: () => eventApi.list(query),
  });

  const [showPromo, setShowPromo] = useState(false);
  const [promoEvent, setPromoEvent] = useState<{
    id: string;
    img: string;
  } | null>(null);

  useEffect(() => {
    if (showPromo) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showPromo]);

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
      {/* Industrial Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: mechanicalEase }}
        className="relative overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--dark-panel)] p-8 shadow-[var(--shadow-floating)] lg:p-12"
      >
        {/* Carbon Fiber Texture Overlay */}
        <div
          className="absolute inset-0 opacity-20 "
          style={{
            backgroundImage: "url('/images/hero_image1.jpg')",
          }}
        />

        {/* Content Grid */}
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.45, ease: mechanicalEase }}
            className="flex flex-col gap-4"
          >
            {/* System Status Badge */}
            <div className="flex items-center gap-2">
              <LED status="accent" size="sm" />
              <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--dark-text-muted)]">
                TicketRush Platform
              </span>
            </div>

            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white drop-shadow-lg sm:text-4xl lg:text-5xl">
              Snag the best seats
              <br />
              <span className="text-[var(--accent)]">without the chaos.</span>
            </h1>

            <p className="max-w-lg text-base text-white lg:text-lg">
              Real-time seating maps, fair queues, and lightning-fast checkout.
              Experience ticket booking as it should be.
            </p>

            {/* Feature Pills */}
            <div className="mt-2 flex flex-wrap gap-2">
              {["Real-time Maps", "Fair Queue", "Instant Checkout"].map(
                (feature) => (
                  <span
                    key={feature}
                    className="rounded-full bg-white/10 px-3 py-1.5 font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-white/80"
                  >
                    {feature}
                  </span>
                )
              )}
            </div>
          </motion.div>

        </div>
      </motion.section>

      {/* Search & Filter Row */}
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
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="filter-badge">{activeCount}</span>
          )}
        </button>
      </div>

      {/* Filter Modal */}
      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={setFilters}
        meta={meta}
        initial={filters}
      />

      {/* Event Grid */}
      <section>
        {isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="card animate-pulse overflow-hidden rounded-[var(--radius-xl)]"
              >
                <div className="h-44 bg-[var(--muted)]" />
                <div className="p-5">
                  <div className="mb-3 h-3 w-20 rounded bg-[var(--muted)]" />
                  <div className="mb-2 h-5 w-3/4 rounded bg-[var(--muted)]" />
                  <div className="h-4 w-1/2 rounded bg-[var(--muted)]" />
                </div>
              </div>
            ))}
          </div>
        )}

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
              Failed to load events
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Please check your connection and try again.
            </p>
          </div>
        )}

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
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <p className="font-semibold text-[var(--text-primary)]">
              No events found
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Try adjusting your filters or search terms.
            </p>
          </div>
        )}

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.05 } },
          }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {data?.map((event) => {
            const img = mainImageUrl(event);
            return (
              <motion.div
                key={event.id}
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.32, ease: mechanicalEase },
                  },
                }}
                whileHover={{ y: -4 }}
              >
                <Link
                  to={`/events/${event.id}`}
                  className="card card-screws group block cursor-pointer overflow-hidden rounded-[var(--radius-xl)]"
                >
                {/* Image with grayscale effect */}
                <div className="relative h-44 overflow-hidden">
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="h-full w-full object-cover grayscale-[30%] transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)]">
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-50"
                      >
                        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                        <path d="M13 5v2" />
                        <path d="M13 17v2" />
                        <path d="M13 11v2" />
                      </svg>
                    </div>
                  )}

                  {/* Status Badge Overlay */}
                  <div className="absolute right-3 top-3">
                    <Badge
                      variant={
                        event.status === "PUBLISHED"
                          ? "success"
                          : event.status === "ENDED"
                            ? "muted"
                            : "warning"
                      }
                      led
                    >
                      {event.status}
                    </Badge>
                  </div>
                </div>

                {/* Card Content */}
                <div className="flex flex-1 flex-col gap-2 p-5">
                  {/* Location Label */}
                  <div className="flex items-center gap-2">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[var(--text-muted)]"
                    >
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {event.venue.city}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold leading-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
                    {event.title}
                  </h3>

                  {/* Venue & Category */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-[var(--text-muted)]">
                      {event.venue.name}
                    </span>
                    {event.category && (
                      <Badge variant="accent">{event.category}</Badge>
                    )}
                  </div>

                  {/* Date */}
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[var(--text-muted)]"
                    >
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                      <line x1="16" x2="16" y1="2" y2="6" />
                      <line x1="8" x2="8" y1="2" y2="6" />
                      <line x1="3" x2="21" y1="10" y2="10" />
                    </svg>
                    <span className="font-mono text-xs text-[var(--text-muted)]">
                      {formatDateTime(event.event_date)}
                    </span>
                  </div>
                </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* Promo Popup */}
      {showPromo && promoEvent && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
          style={{
            background: "rgba(45, 52, 54, 0.9)",
            animation: "fadeIn 200ms ease-out",
          }}
          onClick={() => setShowPromo(false)}
        >
          <div
            className="relative w-full max-w-4xl"
            style={{ animation: "slideUp 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -right-2 -top-14 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
              onClick={() => setShowPromo(false)}
              aria-label="Close"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <Link
              to={`/events/${promoEvent.id}`}
              className="block overflow-hidden rounded-[var(--radius-xl)] shadow-2xl transition hover:scale-[1.01]"
            >
              <img
                src={promoEvent.img}
                alt="Featured Event"
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
