import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { useQueueWebSocket } from "@/hooks/useQueueWebSocket";
import { eventApi, queueApi } from "@/services/api";
import { useQueueStore } from "@/store/queueStore";

export function WaitingRoomPage() {
  const { id: eventId = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    status,
    position,
    queueSize,
    accessToken,
    setGranted,
    setPosition,
    setStatus,
    setEventId,
    reset,
  } = useQueueStore();

  const [leaving, setLeaving] = useState(false);
  const [dots, setDots] = useState(0);

  // Animated dots
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d + 1) % 4), 500);
    return () => clearInterval(t);
  }, []);

  // Fetch event info
  const eventQ = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventApi.get(eventId),
    enabled: Boolean(eventId),
  });

  // Set event context
  useEffect(() => {
    setEventId(eventId);
    return () => {
      reset();
    };
  }, [eventId, setEventId, reset]);

  // Poll queue status every 3 seconds
  useEffect(() => {
    if (!eventId || !user) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await queueApi.status(eventId);
        if (cancelled) return;
        if (res.status === "GRANTED" && res.access_token) {
          setGranted(res.access_token);
        } else if (res.status === "WAITING") {
          setStatus("WAITING");
          setPosition(res.position, res.queue_size);
        } else if (res.status === "INACTIVE") {
          // Queue was disabled — go straight to booking
          navigate(`/events/${eventId}/book`, { replace: true });
        }
      } catch {
        /* ignore polling errors */
      }
    };

    poll(); // initial
    const t = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [eventId, user, setGranted, setPosition, setStatus, navigate]);

  // Listen for WS grant notification
  const authToken = user ? useQueueStore.getState().accessToken : null;
  const onGrant = useCallback(
    (msg: { user_id: string; access_token: string }) => {
      if (user && msg.user_id === user.id) {
        setGranted(msg.access_token);
      }
    },
    [user, setGranted],
  );
  useQueueWebSocket(eventId, authToken, onGrant);

  // Auto-redirect when granted
  useEffect(() => {
    if (status === "GRANTED" && accessToken) {
      const timer = setTimeout(() => {
        navigate(`/events/${eventId}/book`, { replace: true });
      }, 1500); // Brief delay so user sees the "You're in!" message
      return () => clearTimeout(timer);
    }
  }, [status, accessToken, eventId, navigate]);

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await queueApi.leave(eventId);
    } catch {
      /* ok */
    }
    reset();
    navigate(`/events/${eventId}`, { replace: true });
  };

  const event = eventQ.data;
  const progress =
    position && queueSize > 0
      ? Math.max(0, Math.min(1, 1 - position / (queueSize + 1)))
      : 0;

  // Estimate wait (rough: ~15s per position)
  const estimatedWait = position ? Math.max(1, Math.ceil((position * 15) / 60)) : null;

  const circumference = 2 * Math.PI * 90;
  const strokeDash = circumference * progress;

  if (status === "GRANTED") {
    return (
      <div className="waiting-room">
        <div className="waiting-room-container">
          <div className="waiting-room-granted">
            <div className="waiting-room-checkmark">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="waiting-room-title" style={{ color: "var(--success)" }}>
              You're in!
            </h1>
            <p className="waiting-room-subtitle">
              Redirecting to seat selection{".".repeat(dots)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="waiting-room">
      <div className="waiting-room-container">
        {/* Event Header */}
        {event && (
          <div className="waiting-room-event-info">
            <span className="waiting-room-event-badge">
              <span className="led led-accent" />
              LIVE QUEUE
            </span>
            <h2 className="waiting-room-event-title">{event.title}</h2>
            <p className="waiting-room-event-meta">
              {event.venue.name} · {event.venue.city}
            </p>
          </div>
        )}

        {/* Progress Ring */}
        <div className="waiting-room-ring-container">
          <svg className="waiting-room-ring" viewBox="0 0 200 200">
            {/* Background track */}
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="8"
              style={{ filter: "url(#inset-shadow)" }}
            />
            {/* Progress arc */}
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${circumference}`}
              transform="rotate(-90 100 100)"
              className="waiting-room-ring-progress"
            />
            {/* Inner glow */}
            <defs>
              <filter id="inset-shadow">
                <feOffset dx="2" dy="2" />
                <feGaussianBlur stdDeviation="3" />
                <feComposite operator="out" in="SourceGraphic" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.15" />
                </feComponentTransfer>
                <feBlend in="SourceGraphic" />
              </filter>
            </defs>
          </svg>
          <div className="waiting-room-ring-content">
            <span className="waiting-room-position-label">YOUR POSITION</span>
            <span className="waiting-room-position-number">
              #{position ?? "—"}
            </span>
            <span className="waiting-room-queue-size">
              of {queueSize} in queue
            </span>
          </div>
        </div>

        {/* Status Info */}
        <div className="waiting-room-status-strip">
          <div className="waiting-room-status-item">
            <span className="waiting-room-status-label">Status</span>
            <span className="waiting-room-status-value">
              <span className="led led-warning" />
              Waiting{".".repeat(dots)}
            </span>
          </div>
          {estimatedWait && (
            <div className="waiting-room-status-item">
              <span className="waiting-room-status-label">Est. Wait</span>
              <span className="waiting-room-status-value">
                ~{estimatedWait} min
              </span>
            </div>
          )}
          <div className="waiting-room-status-item">
            <span className="waiting-room-status-label">Queue Size</span>
            <span className="waiting-room-status-value">
              {queueSize} people
            </span>
          </div>
        </div>

        {/* Notice */}
        <div className="waiting-room-notice">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
          </svg>
          <div>
            <p className="waiting-room-notice-title">Please keep this page open</p>
            <p className="waiting-room-notice-text">
              You'll be automatically redirected when it's your turn. Closing or refreshing may lose your spot.
            </p>
          </div>
        </div>

        {/* Animated Pulse Bars */}
        <div className="waiting-room-pulse-bars">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="waiting-room-pulse-bar"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>

        {/* Leave Button */}
        <button
          type="button"
          onClick={handleLeave}
          disabled={leaving}
          className="btn btn-ghost btn-sm waiting-room-leave-btn"
        >
          {leaving ? "Leaving…" : "Leave Queue"}
        </button>
      </div>
    </div>
  );
}
