import { useState, type FormEvent } from "react";

import { LED } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError, authApi } from "@/services/api";

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to change password."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="account-card">
      {/* Header */}
      <div className="mb-6 border-b-2 border-[var(--muted)] pb-6">
        <div className="mb-2 flex items-center gap-2">
          <LED status="warning" size="sm" />
          <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Security Settings
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">
          Change Password
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Choose a strong password you don't use elsewhere.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-5">
        <Input
          label="Current Password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="••••••••"
        />
        <Input
          label="New Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="••••••••"
          hint="Minimum 8 characters"
        />
        <Input
          label="Confirm New Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
        />

        {/* Messages */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg bg-[var(--danger-bg)] p-4">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--danger)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            <p className="text-sm font-medium text-[var(--danger)]">{error}</p>
          </div>
        )}
        {message && (
          <div className="flex items-center gap-3 rounded-lg bg-[var(--success-bg)] p-4">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--success)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-sm font-medium text-[var(--success)]">{message}</p>
          </div>
        )}

        <div className="flex justify-end border-t-2 border-[var(--muted)] pt-5">
          <Button type="submit" loading={submitting}>
            {submitting ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
