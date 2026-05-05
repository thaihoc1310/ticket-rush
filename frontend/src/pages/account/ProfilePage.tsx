import { useEffect, useRef, useState, type FormEvent } from "react";

import { LED } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, authApi, uploadApi } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import type { Gender } from "@/types/auth";

export function ProfilePage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [dob, setDob] = useState(user?.date_of_birth ?? "");
  const [gender, setGender] = useState<Gender | "">(user?.gender ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  if (!user) return null;

  const initials = user.full_name.charAt(0).toUpperCase();
  const displayAvatar = avatarPreview ?? user.avatar;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      let avatarUrl: string | undefined;
      if (pendingAvatarFile) {
        const { avatar_url } = await uploadApi.avatar(pendingAvatarFile);
        avatarUrl = avatar_url;
      }

      const updated = await authApi.updateMe({
        full_name: fullName || undefined,
        date_of_birth: dob || null,
        gender: (gender || null) as Gender | null,
        ...(avatarUrl !== undefined && { avatar: avatarUrl }),
      });

      useAuthStore.getState().setUser(updated);

      if (pendingAvatarFile) {
        setPendingAvatarFile(null);
        if (avatarPreview) {
          URL.revokeObjectURL(avatarPreview);
          setAvatarPreview(null);
        }
      }

      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to save changes."
      );
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = () => fileInputRef.current?.click();

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);

    setPendingAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError(null);
    setMessage(null);
  };

  return (
    <div className="account-card">
      {/* Header */}
      <div className="mb-6 border-b-2 border-[var(--muted)] pb-6">
        <div className="mb-2 flex items-center gap-2">
          <LED status="accent" size="sm" />
          <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Profile Settings
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">
          Basic Information
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Update your personal details and profile photo.
        </p>
      </div>

      {/* Avatar Section */}
      <div className="account-avatar-block">
        <div className="account-avatar">
          {displayAvatar ? (
            <img src={displayAvatar} alt="" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="font-semibold text-[var(--text-primary)]">
            Profile Photo
          </p>
          <p className="font-mono text-[0.6875rem] text-[var(--text-muted)]">
            PNG or JPG, up to ~5 MB
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onPickAvatar}>
              {user.avatar || pendingAvatarFile ? "Change Photo" : "Upload Photo"}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onAvatarChange}
          />
        </div>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Input
          label="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          placeholder="John Doe"
        />
        <Input label="Email" value={user.email} disabled />
        <Input
          label="Date of Birth"
          type="date"
          value={dob ?? ""}
          onChange={(e) => setDob(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="gender" className="input-label">
            Gender
          </label>
          <select
            id="gender"
            value={gender ?? ""}
            onChange={(e) => setGender(e.target.value as Gender | "")}
            className="select-field"
          >
            <option value="">Prefer not to say</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* Messages */}
        {error && (
          <div className="col-span-full flex items-start gap-3 rounded-lg bg-[var(--danger-bg)] p-4">
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
          <div className="col-span-full flex items-center gap-3 rounded-lg bg-[var(--success-bg)] p-4">
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

        <div className="col-span-full flex justify-end border-t-2 border-[var(--muted)] pt-5">
          <Button type="submit" loading={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
