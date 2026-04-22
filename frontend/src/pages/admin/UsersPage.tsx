import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiError, uploadApi, userApi } from "@/services/api";
import type { Gender, Role, User, UserCreatePayload, UserUpdatePayload } from "@/types/auth";

const ROLES: Role[] = ["CUSTOMER", "ADMIN"];
const GENDERS: Array<{ value: Gender | ""; label: string }> = [
  { value: "", label: "Not specified" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

export function UsersPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserCreatePayload & { password: string }>({
    email: "", password: "", full_name: "", date_of_birth: null, gender: null, role: "CUSTOMER",
  });
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploadingUserId, setUploadingUserId] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const pendingUserIdRef = useRef<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: userApi.list,
  });

  const createMut = useMutation({
    mutationFn: (payload: UserCreatePayload) => userApi.create(payload),
    onSuccess: () => { closeModal(); qc.invalidateQueries({ queryKey: ["admin", "users"] }); },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Failed"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UserUpdatePayload }) =>
      userApi.update(id, payload),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      if (editingUser && updated) setEditingUser(updated);
      closeModal();
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Failed"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => userApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const avatarMut = useMutation({
    mutationFn: ({ userId, file }: { userId: string; file: File }) =>
      uploadApi.avatarFor(userId, file),
    onMutate: ({ userId }) => {
      setUploadingUserId(userId);
      setAvatarError(null);
    },
    onSuccess: (result, { userId }) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      if (editingUser && editingUser.id === userId) {
        setEditingUser({ ...editingUser, avatar: result.avatar_url });
      }
    },
    onError: (err: unknown) => {
      setAvatarError(err instanceof ApiError ? err.message : "Upload failed");
    },
    onSettled: () => setUploadingUserId(null),
  });

  const openCreate = () => {
    setEditingUser(null);
    setForm({ email: "", password: "", full_name: "", date_of_birth: null, gender: null, role: "CUSTOMER" });
    setError(null);
    setAvatarError(null);
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setForm({
      email: u.email,
      password: "",
      full_name: u.full_name,
      date_of_birth: u.date_of_birth,
      gender: u.gender,
      role: u.role,
    });
    setError(null);
    setAvatarError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setError(null);
    setAvatarError(null);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (editingUser) {
      const payload: UserUpdatePayload = {
        email: form.email,
        full_name: form.full_name,
        date_of_birth: form.date_of_birth || undefined,
        gender: form.gender || undefined,
        role: form.role,
      };
      if (form.password) payload.password = form.password;
      updateMut.mutate({ id: editingUser.id, payload });
    } else {
      createMut.mutate(form);
    }
  };

  const triggerAvatarUpload = (userId: string) => {
    pendingUserIdRef.current = userId;
    setAvatarError(null);
    avatarRef.current?.click();
  };

  const onAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const userId = pendingUserIdRef.current;
    e.target.value = "";
    pendingUserIdRef.current = null;
    if (!file || !userId) return;
    avatarMut.mutate({ userId, file });
  };

  const users: User[] = data ?? [];
  const avatarUploading = (userId: string) => uploadingUserId === userId;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Users</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Manage user accounts.</p>
        </div>
        <Button onClick={openCreate}>+ Create User</Button>
      </header>

      <section className="rounded-2xl border" style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}>
        <div className="border-b px-6 py-4" style={{ borderColor: "var(--border-primary)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>All users</h2>
        </div>
        {isLoading ? (
          <p className="px-6 py-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
        ) : users.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead style={{ background: "var(--bg-tertiary)" }}>
                <tr className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Gender</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t" style={{ borderColor: "var(--border-primary)" }}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => triggerAvatarUpload(u.id)}
                          disabled={avatarUploading(u.id)}
                          title="Change avatar"
                          className="group relative h-9 w-9 overflow-hidden rounded-full border outline-none transition"
                          style={{ borderColor: "var(--border-primary)", background: "var(--accent-subtle)" }}
                        >
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-xs font-bold"
                              style={{ color: "var(--accent)" }}>
                              {u.full_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span
                            className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100"
                            style={{ background: "rgba(0,0,0,0.55)" }}
                          >
                            Edit
                          </span>
                          {avatarUploading(u.id) && (
                            <span
                              className="absolute inset-0 flex items-center justify-center text-[10px] text-white"
                              style={{ background: "rgba(0,0,0,0.6)" }}
                            >
                              …
                            </span>
                          )}
                        </button>
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3" style={{ color: "var(--text-secondary)" }}>{u.email}</td>
                    <td className="px-6 py-3">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: u.role === "ADMIN" ? "var(--accent-subtle)" : "var(--bg-tertiary)",
                          color: u.role === "ADMIN" ? "var(--accent)" : "var(--text-secondary)",
                        }}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-3" style={{ color: "var(--text-secondary)" }}>{u.gender ?? "—"}</td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="secondary" onClick={() => openEdit(u)}>Edit</Button>
                        <Button variant="ghost"
                          onClick={() => { if (confirm(`Delete "${u.full_name}"?`)) removeMut.mutate(u.id); }}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 py-6 text-sm" style={{ color: "var(--text-muted)" }}>No users found.</p>
        )}
        {avatarError && (
          <p className="border-t px-6 py-3 text-sm"
            style={{ borderColor: "var(--border-primary)", background: "var(--danger-bg)", color: "var(--danger)" }}>
            {avatarError}
          </p>
        )}
      </section>

      <Modal open={modalOpen} onClose={closeModal} title={editingUser ? "Edit User" : "Create User"}>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          {editingUser && (
            <div className="sm:col-span-2 flex items-center gap-4 rounded-xl border p-3"
              style={{ borderColor: "var(--border-primary)", background: "var(--bg-tertiary)" }}>
              <div className="relative h-16 w-16 overflow-hidden rounded-full border"
                style={{ borderColor: "var(--border-primary)", background: "var(--accent-subtle)" }}>
                {editingUser.avatar ? (
                  <img src={editingUser.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xl font-bold"
                    style={{ color: "var(--accent)" }}>
                    {editingUser.full_name.charAt(0).toUpperCase()}
                  </span>
                )}
                {avatarUploading(editingUser.id) && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-white"
                    style={{ background: "rgba(0,0,0,0.6)" }}>
                    …
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Avatar</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Change the user&apos;s profile photo.</p>
                <div>
                  <Button type="button" variant="secondary"
                    onClick={() => triggerAvatarUpload(editingUser.id)}
                    disabled={avatarUploading(editingUser.id)}>
                    {avatarUploading(editingUser.id) ? "Uploading…" : "Upload new"}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <Input label="Full Name" required value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <Input label="Email" type="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label={editingUser ? "New Password (optional)" : "Password"} type="password"
            required={!editingUser} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border-primary)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Gender</label>
            <select value={form.gender ?? ""}
              onChange={(e) => setForm({ ...form, gender: (e.target.value || null) as Gender | null })}
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border-primary)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
              {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
          <Input label="Date of Birth" type="date" value={form.date_of_birth ?? ""}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value || null })} />
          {error && (
            <p className="sm:col-span-2 rounded-md px-3 py-2 text-sm"
              style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{error}</p>
          )}
          {avatarError && editingUser && (
            <p className="sm:col-span-2 rounded-md px-3 py-2 text-sm"
              style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{avatarError}</p>
          )}
          <div className="sm:col-span-2 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending}>
              {editingUser ? "Save Changes" : "Create User"}
            </Button>
          </div>
        </form>
      </Modal>

      <input ref={avatarRef} type="file" accept="image/*" className="hidden"
        onChange={onAvatarFileChange} />
    </div>
  );
}
