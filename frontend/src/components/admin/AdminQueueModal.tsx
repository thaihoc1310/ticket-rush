import { useCallback, useEffect, useRef, useState } from "react";
import ReconnectingWebSocket from "reconnecting-websocket";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAuthStore } from "@/store/authStore";
import { ApiError, queueApi } from "@/services/api";
import type { QueueConfigOut, QueueUser } from "@/types/queue";

const TTL_PRESETS = [
  { label: "2 min", value: 120 },
  { label: "5 min", value: 300 },
  { label: "10 min", value: 600 },
  { label: "15 min", value: 900 },
  { label: "30 min", value: 1800 },
];

function formatElapsed(ts: number): string {
  const sec = Math.floor(Date.now() / 1000 - ts);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ${min % 60}m ago`;
}

function formatRemaining(grantedAt: number, ttl: number): string {
  const remaining = Math.max(0, Math.floor(grantedAt + ttl - Date.now() / 1000));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function remainingPercent(grantedAt: number, ttl: number): number {
  const remaining = Math.max(0, grantedAt + ttl - Date.now() / 1000);
  return Math.min(100, (remaining / ttl) * 100);
}

type Tab = "active" | "waiting";

interface AdminQueueModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string | null;
}

export function AdminQueueModal({ open, onClose, eventId }: AdminQueueModalProps) {
  const [config, setConfig] = useState<QueueConfigOut | null>(null);
  const [grantedUsers, setGrantedUsers] = useState<QueueUser[]>([]);
  const [waitingUsers, setWaitingUsers] = useState<QueueUser[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [maxConcurrent, setMaxConcurrent] = useState(10);
  const [sessionTtl, setSessionTtl] = useState(300);
  const [tab, setTab] = useState<Tab>("active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [, setTick] = useState(0);

  const wsRef = useRef<ReconnectingWebSocket | null>(null);

  // Tick every second for live countdowns
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [open]);

  // Fetch data helper
  const fetchData = useCallback(async () => {
    if (!eventId) return;
    try {
      const [cfg, users] = await Promise.all([
        queueApi.getConfig(eventId),
        queueApi.listUsers(eventId),
      ]);
      setConfig(cfg);
      setEnabled(cfg.enabled);
      setMaxConcurrent(cfg.max_concurrent || 10);
      setSessionTtl(cfg.session_ttl_seconds || 300);
      setGrantedUsers(users.granted);
      setWaitingUsers(users.waiting);
    } catch {
      // Defaults
      setConfig(null);
      setEnabled(false);
      setMaxConcurrent(10);
      setSessionTtl(300);
      setGrantedUsers([]);
      setWaitingUsers([]);
    }
  }, [eventId]);

  // Initial load + WebSocket
  useEffect(() => {
    if (!open || !eventId) return;

    setLoading(true);
    setError(null);
    fetchData().finally(() => setLoading(false));

    // Connect admin WebSocket
    const token = useAuthStore.getState().accessToken;
    if (token) {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${proto}//${window.location.host}/ws/admin/queue/${eventId}?token=${encodeURIComponent(token)}`;
      const ws = new ReconnectingWebSocket(url, [], {
        maxRetries: Infinity,
        maxReconnectionDelay: 10_000,
        minReconnectionDelay: 500,
        connectionTimeout: 4000,
      });

      ws.addEventListener("open", () => setWsConnected(true));
      ws.addEventListener("close", () => setWsConnected(false));
      ws.addEventListener("message", () => {
        // On any admin update, refetch all data
        fetchData();
      });

      wsRef.current = ws;
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setWsConnected(false);
      }
    };
  }, [open, eventId, fetchData]);

  const saveConfig = async () => {
    if (!eventId) return;
    setError(null);
    setLoading(true);
    try {
      const cfg = await queueApi.configure(eventId, {
        max_concurrent: maxConcurrent,
        enabled,
        session_ttl_seconds: sessionTtl,
      });
      setConfig(cfg);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update config");
    } finally {
      setLoading(false);
    }
  };

  const kickUser = async (userId: string) => {
    if (!eventId) return;
    try {
      await queueApi.kick(eventId, userId);
      // Data will refresh via WebSocket
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to kick user");
    }
  };

  const activeCount = config?.current_active ?? grantedUsers.length;
  const maxCount = config?.max_concurrent ?? maxConcurrent;
  const queueLen = config?.queue_length ?? waitingUsers.length;
  const fillPercent = maxCount > 0 ? Math.min(100, (activeCount / maxCount) * 100) : 0;
  const currentTtl = config?.session_ttl_seconds ?? sessionTtl;

  return (
    <Modal open={open} onClose={onClose} title="Queue Management" maxWidth="52rem">
      <div className="aq-panel">
        {/* ── Connection indicator + header ── */}
        <div className="aq-header">
          <div className="aq-header-left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="aq-header-title">Virtual Queue</span>
            <span className={`aq-ws-dot ${wsConnected ? "connected" : "disconnected"}`} title={wsConnected ? "Real-time connected" : "Disconnected"} />
          </div>
          <button
            type="button"
            className="queue-toggle"
            data-enabled={String(enabled)}
            onClick={() => setEnabled(!enabled)}
            aria-label={enabled ? "Disable queue" : "Enable queue"}
          />
        </div>

        {/* ── Stats strip ── */}
        <div className="aq-stats">
          <div className="aq-stat">
            <span className="aq-stat-value">{activeCount}</span>
            <span className="aq-stat-label">Active</span>
          </div>
          <div className="aq-stat">
            <span className="aq-stat-value">{queueLen}</span>
            <span className="aq-stat-label">Waiting</span>
          </div>
          <div className="aq-stat">
            <span className="aq-stat-value">{maxCount}</span>
            <span className="aq-stat-label">Max</span>
          </div>
          <div className="aq-stat">
            <span className="aq-stat-value">{Math.floor(currentTtl / 60)}m</span>
            <span className="aq-stat-label">Session</span>
          </div>
        </div>

        {/* ── Capacity bar ── */}
        <div className="aq-capacity">
          <div className="aq-capacity-header">
            <span className="aq-capacity-label">Capacity</span>
            <span className="aq-capacity-value">{activeCount} / {maxCount}</span>
          </div>
          <div className="aq-capacity-track">
            <div
              className={`aq-capacity-fill ${fillPercent >= 90 ? "critical" : fillPercent >= 70 ? "warning" : ""}`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>

        {/* ── Config section ── */}
        <div className="aq-config">
          <div className="aq-config-row">
            <label>Max Concurrent</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div className="aq-config-row">
            <label>Session TTL</label>
            <div className="aq-ttl-pills">
              {TTL_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`aq-ttl-pill ${sessionTtl === p.value ? "active" : ""}`}
                  onClick={() => setSessionTtl(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={saveConfig} loading={loading} size="sm">
            Save Config
          </Button>
        </div>

        {error && (
          <p className="rounded-md px-3 py-2 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            {error}
          </p>
        )}

        {/* ── Tabs ── */}
        <div className="aq-tabs">
          <button
            type="button"
            className={`aq-tab ${tab === "active" ? "active" : ""}`}
            onClick={() => setTab("active")}
          >
            Active Users
            <span className="aq-tab-count">{grantedUsers.length}</span>
          </button>
          <button
            type="button"
            className={`aq-tab ${tab === "waiting" ? "active" : ""}`}
            onClick={() => setTab("waiting")}
          >
            Waiting Queue
            <span className="aq-tab-count">{waitingUsers.length}</span>
          </button>
        </div>

        {/* ── User lists ── */}
        <div className="aq-user-list">
          {tab === "active" ? (
            grantedUsers.length === 0 ? (
              <p className="aq-empty">No active users</p>
            ) : (
              <table className="aq-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Granted</th>
                    <th>Remaining</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {grantedUsers.map((u) => {
                    const pct = u.granted_at ? remainingPercent(u.granted_at, currentTtl) : 0;
                    const isUrgent = pct < 20;
                    return (
                      <tr key={u.user_id}>
                        <td>
                          <div className="aq-user-info">
                            <div className="aq-user-avatar">
                              {u.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="aq-user-name">{u.full_name}</div>
                              <div className="aq-user-email">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="aq-cell-mono">
                          {u.granted_at ? formatElapsed(u.granted_at) : "—"}
                        </td>
                        <td>
                          {u.granted_at ? (
                            <div className="aq-remaining">
                              <div className="aq-remaining-track">
                                <div
                                  className={`aq-remaining-fill ${isUrgent ? "urgent" : ""}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className={`aq-remaining-text ${isUrgent ? "urgent" : ""}`}>
                                {formatRemaining(u.granted_at, currentTtl)}
                              </span>
                            </div>
                          ) : "—"}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="aq-kick-btn"
                            onClick={() => kickUser(u.user_id)}
                            title="Remove user"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            waitingUsers.length === 0 ? (
              <p className="aq-empty">Queue is empty</p>
            ) : (
              <table className="aq-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User</th>
                    <th>Waiting Since</th>
                  </tr>
                </thead>
                <tbody>
                  {waitingUsers.map((u) => (
                    <tr key={u.user_id}>
                      <td className="aq-cell-mono aq-cell-pos">{u.position}</td>
                      <td>
                        <div className="aq-user-info">
                          <div className="aq-user-avatar">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="aq-user-name">{u.full_name}</div>
                            <div className="aq-user-email">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="aq-cell-mono">
                        {u.joined_at ? formatElapsed(u.joined_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </Modal>
  );
}
