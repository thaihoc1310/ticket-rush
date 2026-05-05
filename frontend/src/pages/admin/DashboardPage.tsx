import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";

import { LED } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/Card";
import { dashboardApi, eventApi } from "@/services/api";
import type { OccupancyOut } from "@/types/dashboard";
import { formatCurrency } from "@/utils/format";

const GENDER_COLORS: Record<string, string> = {
  FEMALE: "#ec4899",
  MALE: "#3b82f6",
  OTHER: "#8b5cf6",
  UNKNOWN: "#4b5563",
};

const chartTooltipStyle = {
  borderRadius: 8,
  border: "none",
  backgroundColor: "var(--dark-panel)",
  color: "#f3f4f6",
  fontSize: 12,
  boxShadow: "var(--shadow-floating)",
};

export function DashboardPage() {
  const [days, setDays] = useState(30);

  const summaryQ = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: dashboardApi.summary,
    refetchInterval: 15_000,
  });
  const revenueQ = useQuery({
    queryKey: ["dashboard", "revenue", days],
    queryFn: () => dashboardApi.revenue(days),
    refetchInterval: 30_000,
  });
  const demoQ = useQuery({
    queryKey: ["dashboard", "demographics"],
    queryFn: dashboardApi.demographics,
    refetchInterval: 60_000,
  });

  const revenueSeries = useMemo(
    () =>
      (revenueQ.data ?? []).map((p) => ({
        date: p.date.slice(5),
        revenue: Number.parseFloat(p.revenue),
        bookings: p.bookings,
      })),
    [revenueQ.data]
  );

  const genderData = useMemo(
    () => (demoQ.data?.by_gender ?? []).filter((g) => g.count > 0),
    [demoQ.data]
  );

  const ageData = useMemo(
    () =>
      (demoQ.data?.by_age ?? []).map((a) => ({ name: a.bracket, count: a.count })),
    [demoQ.data]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <LED status="success" size="sm" />
            <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Real-Time Monitoring
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Refreshes every 15–60 seconds automatically.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Range:
          </span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="select-field"
            style={{ minHeight: "40px", padding: "0.5rem 2.5rem 0.5rem 1rem" }}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </header>

      {/* Stats Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Sales Revenue"
          value={
            summaryQ.data
              ? Number(summaryQ.data.total_revenue).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })
              : "—"
          }
          hint={summaryQ.data ? `${summaryQ.data.total_tickets} tickets` : ""}
          loading={summaryQ.isLoading}
          icon={
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" x2="12" y1="2" y2="22" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
        <StatCard
          label="Confirmed Bookings"
          value={summaryQ.data?.confirmed_bookings.toString() ?? "—"}
          hint="Lifetime"
          loading={summaryQ.isLoading}
          icon={
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              <path d="M13 5v2" />
              <path d="M13 17v2" />
              <path d="M13 11v2" />
            </svg>
          }
        />
        <StatCard
          label="Upcoming Events"
          value={summaryQ.data?.upcoming_events.toString() ?? "—"}
          hint={
            summaryQ.data ? `${summaryQ.data.published_events} published` : ""
          }
          loading={summaryQ.isLoading}
          icon={
            <svg
              width="20"
              height="20"
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
          }
        />
        <StatCard
          label="Registered Users"
          value={summaryQ.data?.registered_users.toString() ?? "—"}
          hint="Total accounts"
          loading={summaryQ.isLoading}
          icon={
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
      </section>

      {/* Revenue Chart */}
      <section className="card card-screws p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Revenue Trend
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {revenueQ.isFetching ? "Updating..." : `${days}-day view`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LED status="success" size="sm" />
            <span className="font-mono text-[0.625rem] uppercase text-[var(--text-muted)]">
              Live
            </span>
          </div>
        </div>
        {revenueSeries.length === 0 ? (
          <EmptyChart loading={revenueQ.isLoading} />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <LineChart data={revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  fontSize={11}
                  stroke="var(--text-muted)"
                  fontFamily="JetBrains Mono"
                />
                <YAxis
                  fontSize={11}
                  stroke="var(--text-muted)"
                  fontFamily="JetBrains Mono"
                />
                <Tooltip
                  formatter={(value) => [
                    formatCurrency(Number(value ?? 0)),
                    "Revenue",
                  ]}
                  contentStyle={chartTooltipStyle}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--accent)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: "var(--accent)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Demographics Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Age Distribution */}
        <section className="card card-screws p-6">
          <h2 className="mb-4 text-lg font-bold text-[var(--text-primary)]">
            Audience · Age Distribution
          </h2>
          {ageData.length === 0 ? (
            <EmptyChart loading={demoQ.isLoading} />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <BarChart data={ageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    fontSize={11}
                    stroke="var(--text-muted)"
                    fontFamily="JetBrains Mono"
                  />
                  <YAxis
                    fontSize={11}
                    stroke="var(--text-muted)"
                    allowDecimals={false}
                    fontFamily="JetBrains Mono"
                  />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar
                    dataKey="count"
                    fill="var(--accent)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Gender Distribution */}
        <section className="card card-screws p-6">
          <h2 className="mb-4 text-lg font-bold text-[var(--text-primary)]">
            Audience · Gender Distribution
          </h2>
          {genderData.length === 0 ? (
            <EmptyChart loading={demoQ.isLoading} />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="count"
                    nameKey="gender"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {genderData.map((g) => (
                      <Cell
                        key={g.gender}
                        fill={GENDER_COLORS[g.gender] ?? "#6b7280"}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    formatter={(value) => (
                      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* Top Events & Occupancy */}
      <TopEventsAndOccupancy />
    </div>
  );
}

function TopEventsAndOccupancy() {
  const topQ = useQuery({
    queryKey: ["dashboard", "top-events"],
    queryFn: () => dashboardApi.topEvents(5),
    refetchInterval: 30_000,
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const top = topQ.data ?? [];

  const eventId = selectedEventId ?? top[0]?.event_id ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      {/* Top Events Table */}
      <section className="card card-screws overflow-hidden p-0">
        <div className="border-b-2 border-[var(--muted)] p-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            Top Events by Tickets Sold
          </h2>
        </div>
        {topQ.isLoading ? (
          <div className="p-5">
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-[var(--muted)]"
                />
              ))}
            </div>
          </div>
        ) : top.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">
            No confirmed bookings yet.
          </div>
        ) : (
          <div className="table-container shadow-none">
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th className="text-right">Tickets</th>
                  <th className="text-right">Revenue</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {top.map((e) => (
                  <tr
                    key={e.event_id}
                    className={eventId === e.event_id ? "table-highlight" : ""}
                  >
                    <td className="font-semibold">
                      <Link
                        to="/admin/events"
                        className="transition hover:text-[var(--accent)]"
                      >
                        {e.title}
                      </Link>
                    </td>
                    <td className="text-right font-mono text-[var(--text-muted)]">
                      {e.tickets}
                    </td>
                    <td className="text-right font-mono font-bold text-[var(--accent)]">
                      {formatCurrency(e.revenue)}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedEventId(e.event_id)}
                        className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--accent)] transition hover:text-[var(--accent-hover)]"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Occupancy Card */}
      <OccupancyCard eventId={eventId} />
    </div>
  );
}

function OccupancyCard({ eventId }: { eventId: string | null }) {
  const occupancyQ = useQuery({
    queryKey: ["dashboard", "occupancy", eventId],
    queryFn: () => dashboardApi.occupancy(eventId as string),
    enabled: Boolean(eventId),
    refetchInterval: 10_000,
  });

  const listQ = useQuery({
    queryKey: ["dashboard", "event-list"],
    queryFn: () => eventApi.list({ limit: 50 }),
  });

  const [localEventId, setLocalEventId] = useState<string | null>(eventId);
  const selected = localEventId ?? eventId;

  const data = occupancyQ.data;

  return (
    <section className="card card-screws p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          Occupancy
        </h2>
        <select
          value={selected ?? ""}
          onChange={(e) => setLocalEventId(e.target.value || null)}
          className="select-field"
          style={{
            minHeight: "36px",
            padding: "0.375rem 2rem 0.375rem 0.75rem",
            fontSize: "0.75rem",
          }}
        >
          <option value="">Select event...</option>
          {(listQ.data ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </div>
      {!selected ? (
        <div className="flex h-52 items-center justify-center rounded-lg bg-[var(--muted)] shadow-[var(--shadow-recessed)]">
          <p className="text-sm text-[var(--text-muted)]">
            Select an event to see fill rate.
          </p>
        </div>
      ) : occupancyQ.isLoading || !data ? (
        <div className="flex h-52 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
        </div>
      ) : (
        <OccupancyBody data={data} />
      )}
    </section>
  );
}

function OccupancyBody({ data }: { data: OccupancyOut }) {
  const pct = data.total_seats
    ? Math.round((data.sold / data.total_seats) * 100)
    : 0;
  const rows = data.by_zone.map((z) => ({
    name: z.name,
    sold: z.sold,
    locked: z.locked,
    available: z.available,
    color: z.color,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="rounded-lg bg-[var(--muted)] p-4 shadow-[var(--shadow-recessed)]">
        <p className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          {data.event_title}
        </p>
        <p className="mt-1 font-mono text-4xl font-extrabold text-[var(--accent)]">
          {pct}%
        </p>
        <p className="mt-1 font-mono text-[0.6875rem] text-[var(--text-muted)]">
          {data.sold} sold · {data.locked} held · {data.available} available
        </p>
      </div>

      {/* Zone Chart */}
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No zones configured.</p>
      ) : (
        <div className="h-44 w-full">
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                type="number"
                fontSize={11}
                stroke="var(--text-muted)"
                allowDecimals={false}
                fontFamily="JetBrains Mono"
              />
              <YAxis
                dataKey="name"
                type="category"
                fontSize={11}
                stroke="var(--text-muted)"
                width={70}
                fontFamily="JetBrains Mono"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: "var(--dark-panel)",
                  color: "#f3f4f6",
                  fontSize: 11,
                }}
              />
              <Bar dataKey="sold" stackId="a" fill="#ef4444" />
              <Bar dataKey="locked" stackId="a" fill="#f59e0b" />
              <Bar dataKey="available" stackId="a" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function EmptyChart({ loading }: { loading?: boolean }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-lg bg-[var(--muted)] shadow-[var(--shadow-recessed)]">
      {loading ? (
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
      ) : (
        <p className="text-sm text-[var(--text-muted)]">
          No data in this range yet.
        </p>
      )}
    </div>
  );
}
