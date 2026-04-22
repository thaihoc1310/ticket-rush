import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

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
          i === null ? i : Math.min(i + 1, (eventQ.data?.images?.length ?? 1) - 1),
        );
      if (e.key === "ArrowLeft")
        setLightboxIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, eventQ.data?.images?.length]);

  if (eventQ.isLoading) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Loading…
      </p>
    );
  }
  if (eventQ.error || !eventQ.data) {
    return (
      <div
        className="rounded-2xl border border-dashed p-10 text-center text-sm"
        style={{
          borderColor: "var(--border-primary)",
          background: "var(--bg-secondary)",
          color: "var(--text-muted)",
        }}
      >
        Event not found.{" "}
        <Link to="/" className="hover:opacity-80" style={{ color: "var(--accent)" }}>
          Back to events
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
      <section
        className="rounded-3xl p-10 shadow-lg"
        style={{
          color: "#fff",
          background: heroBg
            ? `linear-gradient(rgba(10, 10, 25, 0.55), rgba(10, 10, 25, 0.55)), url(${heroBg})`
            : "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest opacity-90">
          {event.status}
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{event.title}</h1>
        <p className="mt-2 opacity-90">{formatDateTime(event.event_date)}</p>
        <p className="text-sm opacity-80">
          {event.venue.name} · {event.venue.city}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section
          className="rounded-2xl border p-6 shadow-sm"
          style={{
            borderColor: "var(--border-primary)",
            background: "var(--bg-secondary)",
          }}
        >
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            About this event
          </h2>
          <p
            className="mt-3 whitespace-pre-line text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {event.description || "No description provided."}
          </p>

          {images.length > 0 && (
            <div className="mt-6">
              <h3
                className="mb-3 text-sm font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
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

        <aside
          className="flex flex-col gap-4 rounded-2xl border p-6 shadow-sm"
          style={{
            borderColor: "var(--border-primary)",
            background: "var(--bg-secondary)",
          }}
        >
          <div>
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Zones &amp; pricing
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {zones.length} zones · {totalSeats} total seats
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {zones.length === 0 ? (
              <li className="text-sm" style={{ color: "var(--text-muted)" }}>
                No zones configured yet.
              </li>
            ) : (
              zones.map((z) => (
                <li
                  key={z.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border-primary)" }}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: z.color }}
                    />
                    <span
                      className="font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {z.name}
                    </span>
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatCurrency(z.price)}
                  </span>
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
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
            className="btn btn-primary mt-2"
          >
            {event.status === "PUBLISHED"
              ? zones.length === 0
                ? "No seats configured"
                : "Book seats"
              : "Not on sale"}
          </button>
        </aside>
      </div>

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
            ✕
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
