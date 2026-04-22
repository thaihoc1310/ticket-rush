import { useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { ThemeToggle } from "@/components/ui/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, uploadApi } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

import { UserMenu } from "./UserMenu";

export function AppShell() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const onPickAvatar = () => {
    setUploadError(null);
    avatarInputRef.current?.click();
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { avatar_url } = await uploadApi.avatar(file);
      useAuthStore.getState().setUser({ ...user, avatar: avatar_url });
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      <header
        className="border-b"
        style={{
          borderColor: "var(--border-primary)",
          background: "var(--bg-secondary)",
        }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight"
            style={{ color: "var(--accent)" }}
          >
            TicketRush
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {status === "authenticated" && user ? (
              <>
                {user.role === "ADMIN" && (
                  <NavLink
                    to="/admin/dashboard"
                    className={({ isActive }) =>
                      `text-sm font-medium transition ${
                        isActive ? "" : "hover:opacity-80"
                      }`
                    }
                    style={({ isActive }) => ({
                      color: isActive ? "var(--accent)" : "var(--text-secondary)",
                    })}
                  >
                    Admin
                  </NavLink>
                )}
                <UserMenu
                  user={user}
                  onLogout={onLogout}
                  onAvatarClick={onPickAvatar}
                  uploading={uploading}
                />
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onAvatarChange}
                />
              </>
            ) : (
              <>
                <NavLink
                  to="/login"
                  className="text-sm hover:opacity-80"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Log in
                </NavLink>
                <Link
                  to="/register"
                  className="rounded-md px-3 py-1.5 text-sm font-semibold text-white"
                  style={{ background: "var(--accent)" }}
                >
                  Sign up
                </Link>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
        {uploadError && (
          <div
            className="mx-auto max-w-6xl px-4 pb-2 text-xs"
            style={{ color: "var(--danger)" }}
          >
            {uploadError}
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
