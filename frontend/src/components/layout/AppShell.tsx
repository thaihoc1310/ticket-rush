import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";

export function AppShell() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-lg font-bold text-indigo-600">
            TicketRush
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "text-indigo-600" : "hover:text-slate-900"
              }
            >
              Events
            </NavLink>
            {status === "authenticated" && user ? (
              <>
                <NavLink
                  to="/tickets"
                  className={({ isActive }) =>
                    isActive ? "text-indigo-600" : "hover:text-slate-900"
                  }
                >
                  My tickets
                </NavLink>
                {user.role === "ADMIN" && (
                  <NavLink
                    to="/admin/dashboard"
                    className={({ isActive }) =>
                      isActive ? "text-indigo-600" : "hover:text-slate-900"
                    }
                  >
                    Admin
                  </NavLink>
                )}
                <span className="text-slate-500">
                  Hi, <span className="font-medium text-slate-800">{user.full_name}</span>
                </span>
                <Button variant="ghost" onClick={onLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="hover:text-slate-900">
                  Log in
                </NavLink>
                <Link
                  to="/register"
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-500"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
