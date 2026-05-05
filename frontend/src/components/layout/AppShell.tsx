import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { LED } from "@/components/ui/Badge";
import { useAuth } from "@/hooks/useAuth";

import { UserMenu } from "./UserMenu";

export function AppShell() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      {/* Industrial Navigation Header */}
      <header className="nav-header">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          {/* Logo with LED indicator */}
          <Link to="/" className="logo group">
            <span className="logo-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                <path d="M13 5v2" />
                <path d="M13 17v2" />
                <path d="M13 11v2" />
              </svg>
            </span>
            <span className="transition-colors group-hover:text-[var(--accent-hover)]">
              TicketRush
            </span>
          </Link>

          {/* Navigation & User Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* System Status LED */}
            <div className="hidden items-center gap-2 rounded-full bg-[var(--muted)] px-3 py-1.5 sm:flex">
              <LED status="success" size="sm" />
              <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                System Online
              </span>
            </div>

            {status === "authenticated" && user ? (
              <>
                {user.role === "ADMIN" && (
                  <NavLink
                    to="/admin/dashboard"
                    className={({ isActive }) =>
                      `nav-link ${isActive ? "active" : ""}`
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
                      <rect width="7" height="9" x="3" y="3" rx="1" />
                      <rect width="7" height="5" x="14" y="3" rx="1" />
                      <rect width="7" height="9" x="14" y="12" rx="1" />
                      <rect width="7" height="5" x="3" y="16" rx="1" />
                    </svg>
                    <span className="hidden sm:inline">Admin</span>
                  </NavLink>
                )}
                <NavLink
                  to="/tickets"
                  className={({ isActive }) =>
                    `nav-link ${isActive ? "active" : ""}`
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
                    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                    <path d="M13 5v2" />
                    <path d="M13 17v2" />
                    <path d="M13 11v2" />
                  </svg>
                  <span className="hidden sm:inline">My Tickets</span>
                </NavLink>
                <UserMenu user={user} onLogout={onLogout} />
              </>
            ) : (
              <>
                <NavLink to="/login" className="nav-link">
                  Log in
                </NavLink>
                <Link to="/register" className="btn btn-primary btn-sm btn-inline">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Outlet />
      </main>

      {/* Industrial Footer */}
      <footer className="mt-auto border-t-2 border-[var(--muted)] bg-[var(--background)] py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              TicketRush v1.0
            </span>
            <div className="h-4 w-px bg-[var(--muted)]" />
            <div className="flex items-center gap-2">
              <LED status="success" size="sm" />
              <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-[var(--text-muted)]">
                All Systems Operational
              </span>
            </div>
          </div>
          <p className="font-mono text-[0.6875rem] text-[var(--text-muted)]">
            © 2026 TicketRush. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
