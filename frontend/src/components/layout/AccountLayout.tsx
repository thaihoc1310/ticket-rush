import { NavLink, Outlet } from "react-router-dom";

import { ProtectedRoute } from "@/routes/ProtectedRoute";

export function AccountLayout() {
  return (
    <ProtectedRoute>
      <div className="account-shell">
        <aside className="account-sidebar">
          <div className="mb-4 border-b-2 border-[var(--muted)] pb-4">
            <p className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Account Settings
            </p>
          </div>
          <nav className="flex flex-col gap-1">
            <NavLink
              to="/account"
              end
              className={({ isActive }) =>
                `account-nav-link${isActive ? " is-active" : ""}`
              }
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Basic Information
            </NavLink>
            <NavLink
              to="/account/password"
              className={({ isActive }) =>
                `account-nav-link${isActive ? " is-active" : ""}`
              }
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Change Password
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
