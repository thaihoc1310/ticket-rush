import { NavLink, Outlet } from "react-router-dom";

import { ProtectedRoute } from "@/routes/ProtectedRoute";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
    isActive
      ? "text-[var(--accent)]"
      : "hover:text-[var(--text-primary)]"
  }`;

export function AdminLayout() {
  return (
    <ProtectedRoute role="ADMIN">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border p-4" style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Admin
          </p>
          <nav className="flex flex-row flex-wrap gap-1 lg:flex-col" style={{ color: "var(--text-secondary)" }}>
            <NavLink to="/admin/dashboard" className={linkClass}>Dashboard</NavLink>
            <NavLink to="/admin/events" className={linkClass}>Events</NavLink>
            <NavLink to="/admin/venues" className={linkClass}>Venues</NavLink>
            <NavLink to="/admin/users" className={linkClass}>Users</NavLink>
            <NavLink to="/admin/payments" className={linkClass}>Payments</NavLink>
          </nav>
        </aside>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </ProtectedRoute>
  );
}
