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

import { dashboardApi, eventApi } from "@/services/api";
import type { OccupancyOut } from "@/types/dashboard";
import { formatCurrency } from "@/utils/format";

const GENDER_COLORS: Record<string, string> = {
  FEMALE: "#ec4899",
  MALE: "#3b82f6",
  OTHER: "#8b5cf6",
  UNKNOWN: "#cbd5e1",
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
        date: p.date.slice(5), // MM-DD
        revenue: Number.parseFloat(p.revenue),
        bookings: p.bookings,
      })),
    [revenueQ.data],
  );

  const genderData = useMemo(
    () => (demoQ.data?.by_gender ?? []).filter((g) => g.count > 0),
    [demoQ.data],
  );

  const ageData = useMemo(
    () => (demoQ.data?.by_age ?? []).map((a) => ({ name: a.bracket, count: a.count })),
    [demoQ.data],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Real-time overview. Refreshes every 15–60 seconds.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Range:
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={
            summaryQ.data ? formatCurrency(summaryQ.data.total_revenue) : "—"
          }
          hint={summaryQ.data ? `${summaryQ.data.total_tickets} tickets` : ""}
          loading={summaryQ.isLoading}
        />
        <StatCard
          label="Confirmed bookings"
          value={summaryQ.data?.confirmed_bookings.toString() ?? "—"}
          hint="Lifetime"
          loading={summaryQ.isLoading}
        />
        <StatCard
          label="Upcoming events"
          value={summaryQ.data?.upcoming_events.toString() ?? "—"}
          hint={
            summaryQ.data
              ? `${summaryQ.data.published_events} published`
              : ""
          }
          loading={summaryQ.isLoading}
        />
        <StatCard
          label="Users"
          value={summaryQ.data?.registered_users.toString() ?? "—"}
          hint="Registered"
          loading={summaryQ.isLoading}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Revenue</h2>
          <span className="text-xs text-slate-500">
            {revenueQ.isFetching ? "updating…" : `${days}-day view`}
          </span>
        </div>
        {revenueSeries.length === 0 ? (
          <EmptyChart loading={revenueQ.isLoading} />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <LineChart data={revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={12} stroke="#64748b" />
                <YAxis fontSize={12} stroke="#64748b" />
                <Tooltip
                  formatter={(value) => [
                    formatCurrency(Number(value ?? 0)),
                    "Revenue",
                  ]}
                  contentStyle={{
                    borderRadius: 8,
                    borderColor: "#e2e8f0",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Audience · Age
          </h2>
          {ageData.length === 0 ? (
            <EmptyChart loading={demoQ.isLoading} />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <BarChart data={ageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" fontSize={12} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: "#e2e8f0",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Audience · Gender
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
                        fill={GENDER_COLORS[g.gender] ?? "#94a3b8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: "#e2e8f0",
                      fontSize: 12,
                    }}
                  />
                  <Legend verticalAlign="bottom" height={28} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

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

  // Default select the first top event
  const eventId = selectedEventId ?? top[0]?.event_id ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Top events by tickets sold
        </h2>
        {topQ.isLoading ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : top.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No confirmed bookings yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-2 py-2">Event</th>
                <th className="px-2 py-2 text-right">Tickets</th>
                <th className="px-2 py-2 text-right">Revenue</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {top.map((e) => (
                <tr
                  key={e.event_id}
                  className={
                    eventId === e.event_id ? "bg-indigo-50/70" : undefined
                  }
                >
                  <td className="px-2 py-2 font-medium text-slate-900">
                    <Link
                      to={`/admin/events`}
                      className="hover:text-indigo-600"
                    >
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-right text-slate-700">
                    {e.tickets}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold text-slate-900">
                    {formatCurrency(e.revenue)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedEventId(e.event_id)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      View occupancy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Occupancy</h2>
        <select
          value={selected ?? ""}
          onChange={(e) => setLocalEventId(e.target.value || null)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
        >
          <option value="">Pick an event…</option>
          {(listQ.data ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </div>
      {!selected ? (
        <p className="text-sm text-slate-500">Select an event to see its fill rate.</p>
      ) : occupancyQ.isLoading || !data ? (
        <p className="text-sm text-slate-500">Loading…</p>
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
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {data.event_title}
        </p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{pct}%</p>
        <p className="text-xs text-slate-500">
          {data.sold} sold · {data.locked} held · {data.available} available ·{" "}
          {data.unassigned} unassigned
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No zones configured.</p>
      ) : (
        <div className="h-52 w-full">
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" fontSize={12} stroke="#64748b" allowDecimals={false} />
              <YAxis
                dataKey="name"
                type="category"
                fontSize={12}
                stroke="#64748b"
                width={80}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  borderColor: "#e2e8f0",
                  fontSize: 12,
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

function StatCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      {loading ? (
        <div className="mt-2 h-7 w-24 animate-pulse rounded bg-slate-200" />
      ) : (
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      )}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function EmptyChart({ loading }: { loading?: boolean }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-slate-400">
      {loading ? "Loading…" : "No data in this range yet."}
    </div>
  );
}
