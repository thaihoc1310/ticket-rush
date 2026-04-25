import { useEffect, useRef, useState, type FormEvent } from "react";

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

  // --- Avatar preview state ---
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Cleanup object URL on unmount or when preview changes
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
      // Step 1: Upload pending avatar file if exists
      let avatarUrl: string | undefined;
      if (pendingAvatarFile) {
        const { avatar_url } = await uploadApi.avatar(pendingAvatarFile);
        avatarUrl = avatar_url;
      }

      // Step 2: Update profile (including avatar URL if uploaded)
      const updated = await authApi.updateMe({
        full_name: fullName || undefined,
        date_of_birth: dob || null,
        gender: (gender || null) as Gender | null,
        ...(avatarUrl !== undefined && { avatar: avatarUrl }),
      });

      useAuthStore.getState().setUser(updated);

      // Clear pending avatar state
      if (pendingAvatarFile) {
        setPendingAvatarFile(null);
        if (avatarPreview) {
          URL.revokeObjectURL(avatarPreview);
          setAvatarPreview(null);
        }
      }

      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = () => fileInputRef.current?.click();

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    // Revoke previous preview URL to avoid memory leak
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);

    setPendingAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError(null);
    setMessage(null);
  };

  return (
    <div className="account-card">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Basic information
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Update your personal details and profile photo.
        </p>
      </div>

      <div className="account-avatar-block mt-6">
        <div className="account-avatar">
          {displayAvatar ? <img src={displayAvatar} alt="" /> : <span>{initials}</span>}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Profile photo
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            PNG or JPG, up to ~5 MB.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onPickAvatar}
            >
              {user.avatar || pendingAvatarFile ? "Change photo" : "Upload photo"}
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

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Input label="Email" value={user.email} disabled />
        <Input
          label="Date of birth"
          type="date"
          value={dob ?? ""}
          onChange={(e) => setDob(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gender" className="input-label">
            Gender
          </label>
          <select
            id="gender"
            value={gender ?? ""}
            onChange={(e) => setGender(e.target.value as Gender | "")}
            className="input-field"
          >
            <option value="">Prefer not to say</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {error && (
          <p
            className="col-span-full rounded-md px-3 py-2 text-sm"
            style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
          >
            {error}
          </p>
        )}
        {message && (
          <p
            className="col-span-full rounded-md px-3 py-2 text-sm"
            style={{ background: "var(--success-bg)", color: "var(--success)" }}
          >
            {message}
          </p>
        )}

        <div className="col-span-full flex justify-end">
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
