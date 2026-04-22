import { NavLink, Outlet } from "react-router-dom";

import { ProtectedRoute } from "@/routes/ProtectedRoute";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `account-nav-link${isActive ? " is-active" : ""}`;

export function AccountLayout() {
  return (
    <ProtectedRoute>
      <div className="account-shell">
        <aside className="account-sidebar">
          <p
            className="mb-2 px-3 pt-1 text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Account
          </p>
          <nav className="flex flex-col gap-1">
            <NavLink to="/account" end className={linkClass}>
              <IconUser />
              Basic information
            </NavLink>
            <NavLink to="/account/password" className={linkClass}>
              <IconLock />
              Change password
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

function IconUser() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
