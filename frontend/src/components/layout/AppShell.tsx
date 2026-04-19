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
    <div className="flex min-h-screen flex-col bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-lg font-bold text-rose-400">
            TicketRush
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-400">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "text-rose-400" : "hover:text-gray-200"
              }
            >
              Events
            </NavLink>
            {status === "authenticated" && user ? (
              <>
                <NavLink
                  to="/tickets"
                  className={({ isActive }) =>
                    isActive ? "text-rose-400" : "hover:text-gray-200"
                  }
                >
                  My tickets
                </NavLink>
                {user.role === "ADMIN" && (
                  <NavLink
                    to="/admin/dashboard"
                    className={({ isActive }) =>
                      isActive ? "text-rose-400" : "hover:text-gray-200"
                    }
                  >
                    Admin
                  </NavLink>
                )}
                <span className="text-gray-500">
                  Hi, <span className="font-medium text-gray-200">{user.full_name}</span>
                </span>
                <Button variant="ghost" onClick={onLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="hover:text-gray-200">
                  Log in
                </NavLink>
                <Link
                  to="/register"
                  className="rounded-md bg-rose-500 px-3 py-1.5 text-white hover:bg-rose-400"
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
