import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { AdminActionBar } from "@/components/admin/AdminActionBar";
import {
  AdminFilterModal,
  countActiveFilters,
  defaultValues,
  type FilterFieldConfig,
  type FilterValues,
} from "@/components/admin/AdminFilterModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { ApiError, uploadApi, userApi } from "@/services/api";
import type { Gender, Role, User, UserCreatePayload, UserUpdatePayload } from "@/types/auth";

const PAGE_SIZE = 10;
const ROLES: Role[] = ["CUSTOMER", "ADMIN"];
const GENDERS: Array<{ value: Gender | ""; label: string }> = [
  { value: "", label: "Not specified" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const FILTER_FIELDS: FilterFieldConfig[] = [
  { key: "role", label: "Role", type: "pills", options: ["CUSTOMER", "ADMIN"] },
  { key: "gender", label: "Gender", type: "pills", options: ["MALE", "FEMALE", "OTHER"] },
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
  
  const avatarRef = useRef<HTMLInputElement>(null);

  // ── Search & Filter ──
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<FilterValues>(defaultValues(FILTER_FIELDS));
  const [currentPage, setCurrentPage] = useState(1);

  // Save changes state for upload API call
  const [isUploading, setIsUploading] = useState(false);

  // Avatar preview state
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: userApi.list,
  });

  const createMut = useMutation({
    mutationFn: (payload: UserCreatePayload) => userApi.create(payload),
    onSuccess: () => { closeModal(); qc.invalidateQueries({ queryKey: ["admin", "users"] }); },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to create user"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UserUpdatePayload }) =>
      userApi.update(id, payload),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      if (editingUser && updated) setEditingUser(updated);
      closeModal();
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to update user"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => userApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const openCreate = () => {
    setEditingUser(null);
    setForm({ email: "", password: "", full_name: "", date_of_birth: null, gender: null, role: "CUSTOMER" });
    setError(null);
    setAvatarError(null);
    setPendingAvatarFile(null);
    setAvatarPreview(null);
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
    setPendingAvatarFile(null);
    setAvatarPreview(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setError(null);
    setAvatarError(null);
    setPendingAvatarFile(null);
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setAvatarError(null);
    
    if (editingUser) {
      let avatarUrl: string | undefined;
      
      if (pendingAvatarFile) {
        setIsUploading(true);
        try {
          const { avatar_url } = await uploadApi.avatarFor(editingUser.id, pendingAvatarFile);
          avatarUrl = avatar_url;
        } catch (err) {
          setAvatarError(err instanceof ApiError ? err.message : "Avatar upload failed.");
          setIsUploading(false);
          return;
        }
        setIsUploading(false);
      }

      const payload: UserUpdatePayload = {
        email: form.email,
        full_name: form.full_name,
        date_of_birth: form.date_of_birth || undefined,
        gender: form.gender || undefined,
        role: form.role,
        ...(avatarUrl !== undefined && { avatar: avatarUrl }),
      };
      if (form.password) payload.password = form.password;
      updateMut.mutate({ id: editingUser.id, payload });
    } else {
      createMut.mutate(form);
    }
  };

  const triggerAvatarUpload = () => {
    setAvatarError(null);
    avatarRef.current?.click();
  };

  const onAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    
    setPendingAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const users: User[] = data ?? [];

  // ── Filtered users ──
  const filteredUsers = useMemo(() => {
    let list = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }
    const roles = filterValues.role as string[];
    if (roles && roles.length > 0) {
      list = list.filter((u) => roles.includes(u.role));
    }
    const genders = filterValues.gender as string[];
    if (genders && genders.length > 0) {
      list = list.filter((u) => u.gender && genders.includes(u.gender));
    }
    return list;
  }, [users, search, filterValues]);

  // Reset to page 1 when search or filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterValues]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const filterCount = countActiveFilters(FILTER_FIELDS, filterValues);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Users</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Manage user accounts.</p>
        </div>
        <Button onClick={openCreate}>+ Create User</Button>
      </header>

      <AdminActionBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search users…"
        filterCount={filterCount}
        onFilterClick={() => setFilterOpen(true)}
      />

      <AdminFilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        fields={FILTER_FIELDS}
        values={filterValues}
        onApply={setFilterValues}
      />

      <section className="rounded-2xl border" style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}>
        <div className="border-b px-6 py-4" style={{ borderColor: "var(--border-primary)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>All users</h2>
        </div>
        {isLoading ? (
          <p className="px-6 py-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
        ) : filteredUsers.length ? (
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
                {paginatedUsers.map((u) => (
                  <tr key={u.id} className="border-t" style={{ borderColor: "var(--border-primary)" }}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-9 w-9 overflow-hidden rounded-full border outline-none"
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
                        </div>
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
      </section>

      <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredUsers.length}
          pageSize={PAGE_SIZE}
        />

      <Modal open={modalOpen} onClose={closeModal} title={editingUser ? "Edit User" : "Create User"}>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          {editingUser && (
            <div className="sm:col-span-2 flex items-center gap-4 rounded-xl border p-3"
              style={{ borderColor: "var(--border-primary)", background: "var(--bg-tertiary)" }}>
              <div className="relative h-16 w-16 overflow-hidden rounded-full border"
                style={{ borderColor: "var(--border-primary)", background: "var(--accent-subtle)" }}>
                {avatarPreview || editingUser.avatar ? (
                  <img src={avatarPreview || editingUser.avatar!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xl font-bold"
                    style={{ color: "var(--accent)" }}>
                    {editingUser.full_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Avatar</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Change the user&apos;s profile photo.</p>
                <div>
                  <Button type="button" variant="secondary"
                    onClick={triggerAvatarUpload}>
                    Upload new
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
            <Button variant="secondary" type="button" onClick={closeModal} disabled={createMut.isPending || updateMut.isPending || isUploading}>Cancel</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending || isUploading}>
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
