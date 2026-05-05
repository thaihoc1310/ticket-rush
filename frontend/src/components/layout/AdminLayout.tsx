import { NavLink, Outlet } from "react-router-dom";

import { LED } from "@/components/ui/Badge";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

const navItems = [
  {
    to: "/admin/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </svg>
    ),
  },
  {
    to: "/admin/events",
    label: "Events",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    ),
  },
  {
    to: "/admin/venues",
    label: "Venues",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 11 18-5v12L3 14v-3z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    ),
  },
  {
    to: "/admin/users",
    label: "Users",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: "/admin/payments",
    label: "Payments",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <line x1="2" x2="22" y1="10" y2="10" />
      </svg>
    ),
  },
];

export function AdminLayout() {
  return (
    <ProtectedRoute role="ADMIN">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        {/* Industrial Sidebar */}
        <aside className="card card-screws sticky top-6 self-start p-4">
          {/* Admin Panel Header */}
          <div className="mb-4 flex items-center gap-3 border-b-2 border-[var(--muted)] pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--dark-panel)] text-white shadow-[var(--shadow-sharp)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <p className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Control Panel
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <LED status="success" size="sm" />
                <span className="font-mono text-[0.625rem] uppercase text-[var(--text-muted)]">
                  Admin Mode
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-[var(--accent-subtle)] text-[var(--accent)] shadow-[var(--shadow-recessed)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--muted)] hover:text-[var(--text-primary)]"
                  }`
                }
              >
                <span className="flex-shrink-0 opacity-70">{item.icon}</span>
                <span className="hidden lg:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* System Info Footer */}
          <div className="mt-4 border-t-2 border-[var(--muted)] pt-4">
            <div className="rounded-lg bg-[var(--muted)] p-3 shadow-[var(--shadow-recessed)]">
              <p className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                System Status
              </p>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[0.6875rem] text-[var(--text-muted)]">
                    Database
                  </span>
                  <LED status="success" size="sm" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[0.6875rem] text-[var(--text-muted)]">
                    Cache
                  </span>
                  <LED status="success" size="sm" />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </ProtectedRoute>
  );
}
