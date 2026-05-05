import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Badge, LED } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { eventApi, zoneApi } from "@/services/api";
import type { EventImage } from "@/types/catalog";
import { formatCurrency, formatDateTime } from "@/utils/format";

export function EventDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const eventQ = useQuery({
    queryKey: ["event", id],
    queryFn: () => eventApi.get(id),
    enabled: Boolean(id),
  });

  const zonesQ = useQuery({
    queryKey: ["event", id, "zones"],
    queryFn: () => zoneApi.listForEvent(id),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight")
        setLightboxIndex((i) =>
          i === null
            ? i
            : Math.min(i + 1, (eventQ.data?.images?.length ?? 1) - 1)
        );
      if (e.key === "ArrowLeft")
        setLightboxIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, eventQ.data?.images?.length]);

  if (eventQ.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="card animate-pulse rounded-[var(--radius-2xl)] p-10">
          <div className="h-4 w-24 rounded bg-[var(--muted)]" />
          <div className="mt-4 h-10 w-3/4 rounded bg-[var(--muted)]" />
          <div className="mt-3 h-4 w-1/2 rounded bg-[var(--muted)]" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="card animate-pulse rounded-[var(--radius-xl)] p-6">
            <div className="h-6 w-40 rounded bg-[var(--muted)]" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full rounded bg-[var(--muted)]" />
              <div className="h-4 w-5/6 rounded bg-[var(--muted)]" />
              <div className="h-4 w-4/6 rounded bg-[var(--muted)]" />
            </div>
          </div>
          <div className="card animate-pulse rounded-[var(--radius-xl)] p-6">
            <div className="h-6 w-32 rounded bg-[var(--muted)]" />
            <div className="mt-4 space-y-2">
              <div className="h-12 w-full rounded bg-[var(--muted)]" />
              <div className="h-12 w-full rounded bg-[var(--muted)]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (eventQ.error || !eventQ.data) {
    return (
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
          Event not found
        </p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          This event may have been removed or the link is incorrect.
        </p>
        <Link to="/" className="btn btn-secondary btn-sm btn-inline mt-4">
          Back to Events
        </Link>
      </div>
    );
  }

  const event = eventQ.data;
  const zones = zonesQ.data ?? [];
  const totalSeats = zones.reduce((sum, z) => sum + z.seat_count, 0);
  const images: EventImage[] = event.images ?? [];
  const mainImg = images.find((i) => i.is_main) ?? images[0];
  const heroBg = mainImg?.image_url ?? event.banner_url;

  return (
    <div className="flex flex-col gap-8">
      {/* Hero Section */}
      <section
        className="relative overflow-hidden rounded-[var(--radius-2xl)] p-8 shadow-[var(--shadow-floating)] lg:p-12"
        style={{
          color: "#fff",
          background: heroBg
            ? `linear-gradient(rgba(45, 52, 54, 0.7), rgba(45, 52, 54, 0.85)), url(${heroBg})`
            : "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Carbon Fiber Overlay */}
        <div
          className="absolute inset-0 opacity-10 mix-blend-overlay"
          style={{
            backgroundImage:
              "url('https://www.transparenttextures.com/patterns/carbon-fibre.png')",
          }}
        />

        <div className="relative">
          {/* Status Badge */}
          <div className="mb-4 flex items-center gap-3">
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
            {event.category && (
              <span className="rounded-full bg-white/20 px-3 py-1 font-mono text-[0.6875rem] font-bold uppercase tracking-wider">
                {event.category}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight drop-shadow-lg sm:text-4xl lg:text-5xl">
            {event.title}
          </h1>

          {/* Date & Venue */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-white/90">
            <div className="flex items-center gap-2">
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
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              <span className="font-mono text-sm">
                {formatDateTime(event.event_date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
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
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="text-sm">
                {event.venue.name} · {event.venue.city}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Main Content */}
        <section className="card card-screws p-6">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            About This Event
          </h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[var(--text-muted)]">
            {event.description || "No description provided."}
          </p>

          {/* Gallery */}
          {images.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-4 flex items-center gap-2 font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
                Gallery
              </h3>
              <div className="gallery-grid">
                {images.map((img, idx) => (
                  <button
                    type="button"
                    key={img.id}
                    onClick={() => setLightboxIndex(idx)}
                    className={`gallery-item ${img.is_main ? "is-main" : ""}`}
                    aria-label="View image"
                  >
                    <img src={img.image_url} alt="" />
                    {img.is_main && (
                      <span className="gallery-main-badge">Main</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Sidebar - Zones & Booking */}
        <aside className="flex flex-col gap-4">
          {/* Zones Card */}
          <div className="card card-screws p-6">
            <div className="mb-4 border-b-2 border-[var(--muted)] pb-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Zones & Pricing
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <LED status="success" size="sm" />
                <span className="font-mono text-[0.6875rem] text-[var(--text-muted)]">
                  {zones.length} zones · {totalSeats} seats
                </span>
              </div>
            </div>

            <ul className="flex flex-col gap-2">
              {zones.length === 0 ? (
                <li className="rounded-lg bg-[var(--muted)] p-4 text-center text-sm text-[var(--text-muted)] shadow-[var(--shadow-recessed)]">
                  No zones configured yet.
                </li>
              ) : (
                zones.map((z) => (
                  <li
                    key={z.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-[var(--background)] p-3 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-floating)]"
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="h-4 w-4 rounded-full shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)]"
                        style={{ backgroundColor: z.color }}
                      />
                      <span className="font-semibold text-[var(--text-primary)]">
                        {z.name}
                      </span>
                    </span>
                    <span className="font-mono font-bold text-[var(--accent)]">
                      {formatCurrency(z.price)}
                    </span>
                  </li>
                ))
              )}
            </ul>

            <Button
              onClick={() => {
                if (!user) {
                  navigate("/login", {
                    state: { from: { pathname: `/events/${event.id}/book` } },
                  });
                } else {
                  navigate(`/events/${event.id}/book`);
                }
              }}
              disabled={event.status !== "PUBLISHED" || zones.length === 0}
              className="mt-4"
              fullWidth
            >
              {event.status === "PUBLISHED"
                ? zones.length === 0
                  ? "No Seats Available"
                  : "Book Seats Now"
                : "Not On Sale"}
            </Button>
          </div>

          {/* Event Info Card */}
          <div className="card p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Event ID</span>
                <span className="font-mono text-[0.75rem] text-[var(--text-primary)]">
                  {event.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <div className="h-px bg-[var(--muted)]" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Venue Capacity</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">
                  {totalSeats}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(null);
            }}
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
          <img
            src={images[lightboxIndex].image_url}
            alt=""
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
