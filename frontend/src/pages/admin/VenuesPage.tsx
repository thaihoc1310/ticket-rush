import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { AdminActionBar } from "@/components/admin/AdminActionBar";
import {
  AdminFilterModal,
  countActiveFilters,
  defaultValues,
  type FilterFieldConfig,
  type FilterValues,
} from "@/components/admin/AdminFilterModal";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiError, venueApi } from "@/services/api";
import type { Venue, VenueCreatePayload } from "@/types/catalog";

const PAGE_SIZE = 20;

const EMPTY: VenueCreatePayload = {
  name: "",
  address: "",
  city: "",
  grid_rows: 10,
  grid_cols: 15,
};

export function VenuesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [form, setForm] = useState<VenueCreatePayload>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  // ── Search & Filter ──
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: venueApi.list,
  });

  const venues: Venue[] = data ?? [];

  // Derive unique cities from data for dynamic pills
  const uniqueCities = useMemo(
    () => [...new Set(venues.map((v) => v.city))].sort(),
    [venues],
  );

  const filterFields: FilterFieldConfig[] = useMemo(
    () =>
      uniqueCities.length > 0
        ? [{ key: "city", label: "City", type: "pills" as const, options: uniqueCities }]
        : [],
    [uniqueCities],
  );

  // Ensure filterValues has defaults if fields change
  const safeFilterValues = useMemo(
    () => ({ ...defaultValues(filterFields), ...filterValues }),
    [filterFields, filterValues],
  );

  // ── Filtered venues ──
  const filteredVenues = useMemo(() => {
    let list = venues;
    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.city.toLowerCase().includes(q) ||
          v.address.toLowerCase().includes(q),
      );
    }
    // City pills
    const cities = safeFilterValues.city as string[];
    if (cities && cities.length > 0) {
      list = list.filter((v) => cities.includes(v.city));
    }
    return list;
  }, [venues, search, safeFilterValues]);

  // Reset to page 1 when search or filters change
  useEffect(() => { setCurrentPage(1); }, [search, safeFilterValues]);

  const totalPages = Math.max(1, Math.ceil(filteredVenues.length / PAGE_SIZE));
  const paginatedVenues = filteredVenues.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const filterCount = countActiveFilters(filterFields, safeFilterValues);

  const create = useMutation({
    mutationFn: venueApi.create,
    onSuccess: () => {
      closeModal();
      qc.invalidateQueries({ queryKey: ["venues"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Failed to create venue"),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<VenueCreatePayload> }) =>
      venueApi.update(id, payload),
    onSuccess: () => {
      closeModal();
      qc.invalidateQueries({ queryKey: ["venues"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Failed to update venue"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => venueApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venues"] }),
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Failed to delete venue"),
  });

  const openCreate = () => {
    setEditingVenue(null);
    setForm(EMPTY);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (v: Venue) => {
    setEditingVenue(v);
    setForm({
      name: v.name,
      address: v.address,
      city: v.city,
      grid_rows: v.grid_rows,
      grid_cols: v.grid_cols,
    });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingVenue(null);
    setForm(EMPTY);
    setError(null);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const payload = {
      ...form,
      grid_rows: Number(form.grid_rows) || 1,
      grid_cols: Number(form.grid_cols) || 1,
    };
    if (editingVenue) {
      update.mutate({ id: editingVenue.id, payload });
    } else {
      create.mutate(payload);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Venues</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Create and manage venues where events take place.
          </p>
        </div>
        <Button onClick={openCreate}>+ Create Venue</Button>
      </header>

      <AdminActionBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search venues…"
        filterCount={filterCount}
        onFilterClick={() => setFilterOpen(true)}
      />

      <AdminFilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        fields={filterFields}
        values={safeFilterValues}
        onApply={setFilterValues}
      />

      <section className="rounded-2xl border" style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}>
        <div className="border-b px-6 py-4" style={{ borderColor: "var(--border-primary)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>All venues</h2>
        </div>
        {isLoading ? (
          <p className="px-6 py-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
        ) : filteredVenues.length ? (
          <table className="w-full text-left text-sm">
            <thead style={{ background: "var(--bg-tertiary)" }}>
              <tr className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">City</th>
                <th className="px-6 py-3">Address</th>
                <th className="px-6 py-3">Layout</th>
                <th className="px-6 py-3">Seats</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginatedVenues.map((v) => (
                <tr key={v.id} className="border-t" style={{ borderColor: "var(--border-primary)" }}>
                  <td className="px-6 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{v.name}</td>
                  <td className="px-6 py-3" style={{ color: "var(--text-secondary)" }}>{v.city}</td>
                  <td className="px-6 py-3" style={{ color: "var(--text-secondary)" }}>{v.address}</td>
                  <td className="px-6 py-3" style={{ color: "var(--text-secondary)" }}>{v.grid_rows} x {v.grid_cols}</td>
                  <td className="px-6 py-3" style={{ color: "var(--text-secondary)" }}>{v.grid_rows * v.grid_cols}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="secondary" onClick={() => openEdit(v)}>Edit</Button>
                      <Button
                        variant="ghost"
                        onClick={() => { if (confirm(`Delete venue "${v.name}"?`)) remove.mutate(v.id); }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-6 py-6 text-sm" style={{ color: "var(--text-muted)" }}>No venues yet.</p>
        )}
      </section>

      <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredVenues.length}
          pageSize={PAGE_SIZE}
        />

      <Modal open={modalOpen} onClose={closeModal} title={editingVenue ? "Edit Venue" : "Create Venue"}>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="City" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <div className="sm:col-span-2">
            <Input label="Address" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <Input label="Rows" type="number" min={1} max={100} required value={form.grid_rows} onChange={(e) => setForm({ ...form, grid_rows: Number(e.target.value) })} />
          <Input label="Seats per row" type="number" min={1} max={100} required value={form.grid_cols} onChange={(e) => setForm({ ...form, grid_cols: Number(e.target.value) })} />
          {error && (
            <p className="sm:col-span-2 rounded-md px-3 py-2 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <div className="sm:col-span-2 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {editingVenue ? "Save Changes" : "Create Venue"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
