import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { User } from "@/types/auth";

interface UserMenuProps {
  user: User;
  onLogout: () => void;
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials =
    user.full_name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? user.email.slice(0, 2).toUpperCase();

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="user-menu-trigger"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="user-menu-avatar">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" />
          ) : (
            <span className="user-menu-initials">{initials}</span>
          )}
        </span>
        <span className="user-menu-name hidden sm:block">
          {user.full_name || user.email.split("@")[0]}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="user-menu-caret"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-heading">
            <p className="user-menu-heading-name">
              {user.full_name || "User"}
            </p>
            <p className="user-menu-heading-email">{user.email}</p>
          </div>
          <div className="user-menu-divider" />
          <Link
            to="/account"
            className="user-menu-item"
            onClick={() => setOpen(false)}
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
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Profile Settings
          </Link>
          <Link
            to="/account/password"
            className="user-menu-item"
            onClick={() => setOpen(false)}
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
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Change Password
          </Link>
          <div className="user-menu-divider" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="user-menu-item user-menu-item-danger"
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
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
