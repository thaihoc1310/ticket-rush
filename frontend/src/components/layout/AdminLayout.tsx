import { NavLink, Outlet } from "react-router-dom";

import { ProtectedRoute } from "@/routes/ProtectedRoute";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
    isActive
      ? "bg-rose-500/10 text-rose-400"
      : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
  }`;

export function AdminLayout() {
  return (
    <ProtectedRoute role="ADMIN">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
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
