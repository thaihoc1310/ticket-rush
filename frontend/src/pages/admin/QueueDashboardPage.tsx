import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReconnectingWebSocket from "reconnecting-websocket";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { LED } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/authStore";
import { ApiError, eventApi, queueApi } from "@/services/api";
import type { QueueConfigOut, QueueUser } from "@/types/queue";

const chartTooltipStyle = {
  borderRadius: 8,
  border: "none",
  backgroundColor: "var(--dark-panel)",
  color: "#f3f4f6",
  fontSize: 12,
  boxShadow: "var(--shadow-floating)",
};

// ── Time formatting helpers ──

function formatElapsed(ts: number): string {
  const sec = Math.floor(Date.now() / 1000 - ts);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s ago`;
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

// ── Real-time chart data point ──
interface ChartPoint {
  time: string;
  active: number;
  waiting: number;
}

type Tab = "active" | "waiting";

export function QueueDashboardPage() {
  const { id: eventId = "" } = useParams<{ id: string }>();

  const [config, setConfig] = useState<QueueConfigOut | null>(null);
  const [grantedUsers, setGrantedUsers] = useState<QueueUser[]>([]);
  const [waitingUsers, setWaitingUsers] = useState<QueueUser[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [maxConcurrent, setMaxConcurrent] = useState(10);
  const [sessionTtlMin, setSessionTtlMin] = useState(5);
  const [tab, setTab] = useState<Tab>("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [, setTick] = useState(0);

  // Real-time chart data (last 60 data points)
  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  const wsRef = useRef<ReconnectingWebSocket | null>(null);

  // Tick every second
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Event info
  const eventQ = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventApi.get(eventId),
    enabled: Boolean(eventId),
  });
  const event = eventQ.data;

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
      setSessionTtlMin(Math.round((cfg.session_ttl_seconds || 300) / 60));
      setGrantedUsers(users.granted);
      setWaitingUsers(users.waiting);

      // Add to chart
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      setChartData((prev) => {
        const next = [...prev, { time: timeStr, active: cfg.current_active, waiting: cfg.queue_length }];
        return next.slice(-60); // keep last 60 points
      });
    } catch {
      setConfig(null);
      setEnabled(false);
    }
  }, [eventId]);

  // Initial load + WebSocket
  useEffect(() => {
    if (!eventId) return;

    fetchData();

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
      ws.addEventListener("message", () => fetchData());

      wsRef.current = ws;
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setWsConnected(false);
      }
    };
  }, [eventId, fetchData]);

  // Save config
  const saveConfig = async () => {
    if (!eventId) return;
    setError(null);
    setSaving(true);
    try {
      const cfg = await queueApi.configure(eventId, {
        max_concurrent: maxConcurrent,
        enabled,
        session_ttl_seconds: sessionTtlMin * 60,
      });
      setConfig(cfg);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const kickUser = async (userId: string) => {
    if (!eventId) return;
    try {
      await queueApi.kick(eventId, userId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to kick user");
    }
  };

  const activeCount = config?.current_active ?? grantedUsers.length;
  const maxCount = config?.max_concurrent ?? maxConcurrent;
  const queueLen = config?.queue_length ?? waitingUsers.length;
  const fillPercent = maxCount > 0 ? Math.min(100, (activeCount / maxCount) * 100) : 0;
  const currentTtl = config?.session_ttl_seconds ?? sessionTtlMin * 60;

  // Chart data memo
  const chartSeries = useMemo(() => chartData, [chartData]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/admin/events"
            className="text-sm font-medium hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            ← Back to Events
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <LED status={wsConnected ? "success" : "danger"} size="sm" />
            <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {wsConnected ? "Real-Time Connected" : "Connecting…"}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold text-[var(--text-primary)]">
            Queue Dashboard
          </h1>
          {event && (
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {event.title} · {event.venue.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Queue
          </span>
          <button
            type="button"
            className="queue-toggle"
            data-enabled={String(enabled)}
            onClick={() => setEnabled(!enabled)}
            aria-label={enabled ? "Disable queue" : "Enable queue"}
          />
        </div>
      </header>

      {/* ── Stats Grid ── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Users"
          value={String(activeCount)}
          hint={`of ${maxCount} max`}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
        <StatCard
          label="In Queue"
          value={String(queueLen)}
          hint="Waiting for access"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
        <StatCard
          label="Capacity"
          value={`${Math.round(fillPercent)}%`}
          hint={`${activeCount}/${maxCount} slots used`}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          }
        />
        <StatCard
          label="Session TTL"
          value={`${Math.floor(currentTtl / 60)}m`}
          hint="Per user limit"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          }
        />
      </section>

      {/* ── Real-time Chart + Config ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Chart */}
        <section className="card card-screws p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Live Activity
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Real-time queue occupancy · last {chartSeries.length} updates
              </p>
            </div>
            <div className="flex items-center gap-2">
              <LED status="success" size="sm" />
              <span className="font-mono text-[0.625rem] uppercase text-[var(--text-muted)]">
                Live
              </span>
            </div>
          </div>
          {chartSeries.length < 2 ? (
            <div className="flex h-56 items-center justify-center rounded-lg bg-[var(--muted)] shadow-[var(--shadow-recessed)]">
              <p className="text-sm text-[var(--text-muted)]">
                Collecting data… chart will appear shortly.
              </p>
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <AreaChart data={chartSeries}>
                  <defs>
                    <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradWaiting" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="time"
                    fontSize={10}
                    stroke="var(--text-muted)"
                    fontFamily="JetBrains Mono"
                    interval="preserveStartEnd"
                    tickCount={6}
                  />
                  <YAxis
                    fontSize={10}
                    stroke="var(--text-muted)"
                    fontFamily="JetBrains Mono"
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="active"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    fill="url(#gradActive)"
                    name="Active"
                  />
                  <Area
                    type="monotone"
                    dataKey="waiting"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#gradWaiting)"
                    name="Waiting"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Config panel */}
        <section className="card card-screws p-6 flex flex-col gap-5">
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            Configuration
          </h2>

          {/* Capacity bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Capacity
              </span>
              <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                {activeCount} / {maxCount}
              </span>
            </div>
            <div className="aq-capacity-track">
              <div
                className={`aq-capacity-fill ${fillPercent >= 90 ? "critical" : fillPercent >= 70 ? "warning" : ""}`}
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          </div>

          {/* Max concurrent */}
          <div className="qd-field">
            <label className="qd-label">Max Concurrent Users</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(Math.max(1, Number(e.target.value)))}
              className="qd-input"
            />
          </div>

          {/* Session TTL */}
          <div className="qd-field">
            <label className="qd-label">Session Time Limit</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={60}
                value={sessionTtlMin}
                onChange={(e) => setSessionTtlMin(Math.max(1, Math.min(60, Number(e.target.value))))}
                className="qd-input"
              />
              <span className="font-mono text-xs font-bold text-[var(--text-muted)]">minutes</span>
            </div>
          </div>

          {error && (
            <p className="rounded-md px-3 py-2 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <Button onClick={saveConfig} loading={saving}>
            Save Configuration
          </Button>
        </section>
      </div>

      {/* ── Tabs + User lists ── */}
      <section className="card card-screws p-0 overflow-hidden">
        <div className="aq-tabs" style={{ borderRadius: 0 }}>
          <button
            type="button"
            className={`aq-tab ${tab === "active" ? "active" : ""}`}
            onClick={() => setTab("active")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            Active Users
            <span className="aq-tab-count">{grantedUsers.length}</span>
          </button>
          <button
            type="button"
            className={`aq-tab ${tab === "waiting" ? "active" : ""}`}
            onClick={() => setTab("waiting")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Waiting Queue
            <span className="aq-tab-count">{waitingUsers.length}</span>
          </button>
        </div>

        <div className="aq-user-list" style={{ maxHeight: "420px", boxShadow: "none", borderRadius: 0 }}>
          {tab === "active" ? (
            grantedUsers.length === 0 ? (
              <p className="aq-empty">No active users at the moment</p>
            ) : (
              <table className="aq-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Granted</th>
                    <th>Time Remaining</th>
                    <th style={{ width: 48 }} />
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
              <p className="aq-empty">Queue is empty — no one is waiting</p>
            ) : (
              <table className="aq-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>#</th>
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
      </section>
    </div>
  );
}
