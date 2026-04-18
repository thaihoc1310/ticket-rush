import { NavLink, Outlet } from "react-router-dom";

import { ProtectedRoute } from "@/routes/ProtectedRoute";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
    isActive
      ? "bg-indigo-100 text-indigo-700"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

export function AdminLayout() {
  return (
    <ProtectedRoute role="ADMIN">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Admin
          </p>
          <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
            <NavLink to="/admin/dashboard" className={linkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/admin/events" className={linkClass}>
              Events
            </NavLink>
            <NavLink to="/admin/venues" className={linkClass}>
              Venues
            </NavLink>
          </nav>
        </aside>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </ProtectedRoute>
  );
}
