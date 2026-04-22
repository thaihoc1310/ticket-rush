import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { User } from "@/types/auth";

interface Props {
  user: User;
  onLogout: () => void;
  onAvatarClick?: () => void;
  uploading?: boolean;
}

export function UserMenu({ user, onLogout, onAvatarClick, uploading }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = user.full_name.charAt(0).toUpperCase();

  return (
    <div className="user-menu" ref={wrapperRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="user-menu-avatar">
          {user.avatar ? (
            <img src={user.avatar} alt="" />
          ) : (
            <span className="user-menu-initials">{initials}</span>
          )}
          {uploading && <span className="user-menu-avatar-overlay">…</span>}
        </span>
        <span className="user-menu-name">{user.full_name}</span>
        <svg
          className="user-menu-caret"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-heading">
            <p className="user-menu-heading-name">{user.full_name}</p>
            <p className="user-menu-heading-email">{user.email}</p>
          </div>
          <div className="user-menu-divider" />
          {onAvatarClick && (
            <button
              type="button"
              className="user-menu-item"
              onClick={() => {
                setOpen(false);
                onAvatarClick();
              }}
            >
              <MenuIcon name="camera" />
              Change avatar
            </button>
          )}
          <Link
            to="/account"
            className="user-menu-item"
            onClick={() => setOpen(false)}
          >
            <MenuIcon name="user" />
            Account info
          </Link>
          <Link
            to="/tickets"
            className="user-menu-item"
            onClick={() => setOpen(false)}
          >
            <MenuIcon name="ticket" />
            My tickets
          </Link>
          <div className="user-menu-divider" />
          <button
            type="button"
            className="user-menu-item user-menu-item-danger"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <MenuIcon name="logout" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuIcon({ name }: { name: "user" | "ticket" | "logout" | "camera" }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "user")
    return (
      <svg {...common}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  if (name === "ticket")
    return (
      <svg {...common}>
        <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" />
        <line x1="13" y1="6" x2="13" y2="18" />
      </svg>
    );
  if (name === "camera")
    return (
      <svg {...common}>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
