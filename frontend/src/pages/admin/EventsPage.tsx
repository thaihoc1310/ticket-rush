import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiError, eventApi, uploadApi, venueApi } from "@/services/api";
import type {
  EventCreatePayload,
  EventImage,
  EventStatus,
  EventSummary,
} from "@/types/catalog";
import { formatDateTime } from "@/utils/format";

const STATUSES: EventStatus[] = ["DRAFT", "PUBLISHED", "ENDED"];

function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

const emptyForm = (): EventCreatePayload => ({
  venue_id: "",
  title: "",
  description: "",
  event_date: "",
  sale_start_at: "",
  banner_url: "",
  status: "DRAFT",
  grid_rows: 10,
  grid_cols: 15,
});

export function EventsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventSummary | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryEvent, setGalleryEvent] = useState<EventSummary | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const venuesQ = useQuery({ queryKey: ["venues"], queryFn: venueApi.list });
  const eventsQ = useQuery({
    queryKey: ["admin", "events"],
    queryFn: () => eventApi.list({ limit: 100 }),
  });

  const create = useMutation({
    mutationFn: (payload: EventCreatePayload) => eventApi.create(payload),
    onSuccess: () => {
      closeModal();
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Failed to create event"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<EventCreatePayload> }) =>
      eventApi.update(id, payload),
    onSuccess: () => {
      closeModal();
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Failed to update event"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EventStatus }) =>
      eventApi.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => eventApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const uploadImages = useMutation({
    mutationFn: ({ eventId, files }: { eventId: string; files: File[] }) =>
      uploadApi.eventImages(eventId, files),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const deleteImage = useMutation({
    mutationFn: (imageId: string) => uploadApi.deleteEventImage(imageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const setMainImage = useMutation({
    mutationFn: (imageId: string) => uploadApi.setMainImage(imageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const openCreate = () => {
    setEditingEvent(null);
    setForm(emptyForm());
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (e: EventSummary) => {
    setEditingEvent(e);
    setForm({
      venue_id: e.venue.id,
      title: e.title,
      description: e.description ?? "",
      event_date: new Date(e.event_date).toISOString().slice(0, 16),
      sale_start_at: e.sale_start_at ? new Date(e.sale_start_at).toISOString().slice(0, 16) : "",
      banner_url: e.banner_url ?? "",
      status: e.status,
      grid_rows: e.grid_rows,
      grid_cols: e.grid_cols,
    });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingEvent(null);
    setForm(emptyForm());
    setError(null);
  };

  const openGallery = (e: EventSummary) => {
    setGalleryEvent(e);
    setGalleryOpen(true);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!form.venue_id) { setError("Please select a venue."); return; }
    if (!form.event_date) { setError("Event date is required."); return; }
    const payload: EventCreatePayload = {
      venue_id: form.venue_id,
      title: form.title,
      description: form.description || null,
      event_date: fromLocalInput(form.event_date),
      sale_start_at: form.sale_start_at ? fromLocalInput(form.sale_start_at) : null,
      banner_url: form.banner_url || null,
      status: form.status,
      grid_rows: Number(form.grid_rows) || 10,
      grid_cols: Number(form.grid_cols) || 15,
    };
    if (editingEvent) {
      updateMut.mutate({ id: editingEvent.id, payload });
    } else {
      create.mutate(payload);
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || !galleryEvent || files.length === 0) return;
    uploadImages.mutate({ eventId: galleryEvent.id, files: Array.from(files) });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const events: EventSummary[] = eventsQ.data ?? [];
  const venues = venuesQ.data ?? [];
  const galleryImages: EventImage[] = galleryEvent
    ? (events.find((e) => e.id === galleryEvent.id)?.images ?? [])
    : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Events</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Create events, toggle status, manage gallery, and configure seats.
          </p>
        </div>
        <Button onClick={openCreate} disabled={venues.length === 0}>+ Create Event</Button>
      </header>

      <section className="rounded-2xl border" style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}>
        <div className="border-b px-6 py-4" style={{ borderColor: "var(--border-primary)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>All events</h2>
        </div>
        {eventsQ.isLoading ? (
          <p className="px-6 py-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
        ) : events.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead style={{ background: "var(--bg-tertiary)" }}>
                <tr className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Venue</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t" style={{ borderColor: "var(--border-primary)" }}>
                    <td className="px-6 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{e.title}</td>
                    <td className="px-6 py-3" style={{ color: "var(--text-secondary)" }}>
                      {e.venue.name} · {e.venue.city}
                    </td>
                    <td className="px-6 py-3" style={{ color: "var(--text-secondary)" }}>
                      {formatDateTime(e.event_date)}
                    </td>
                    <td className="px-6 py-3">
                      <select
                        value={e.status}
                        onChange={(ev) =>
                          updateStatus.mutate({ id: e.id, status: ev.target.value as EventStatus })
                        }
                        className="rounded-md border px-2 py-1 text-xs"
                        style={{
                          borderColor: "var(--border-primary)",
                          background: "var(--bg-tertiary)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openGallery(e)}
                          className="text-sm font-medium transition hover:opacity-80"
                          style={{ color: "var(--accent)" }}
                        >
                          Gallery
                        </button>
                        <Link
                          to={`/admin/events/${e.id}/seats`}
                          className="text-sm font-medium transition hover:opacity-80"
                          style={{ color: "var(--accent)" }}
                        >
                          Seats
                        </Link>
                        <Button variant="secondary" onClick={() => openEdit(e)}>Edit</Button>
                        <Button
                          variant="ghost"
                          onClick={() => { if (confirm(`Delete "${e.title}"?`)) remove.mutate(e.id); }}
                        >
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
          <p className="px-6 py-6 text-sm" style={{ color: "var(--text-muted)" }}>No events yet.</p>
        )}
      </section>

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editingEvent ? "Edit Event" : "Create Event"} maxWidth="40rem">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Input label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Venue</label>
            <select
              required
              value={form.venue_id}
              onChange={(e) => setForm({ ...form, venue_id: e.target.value })}
              className="rounded-md border px-3 py-2 text-sm shadow-sm"
              style={{ borderColor: "var(--border-primary)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
            >
              <option value="">Select a venue…</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
              ))}
            </select>
          </div>
          <Input
            label="Event date & time"
            type="datetime-local"
            required
            value={form.event_date}
            onChange={(e) => setForm({ ...form, event_date: e.target.value })}
          />
          <Input
            label="Sale start (optional)"
            type="datetime-local"
            value={form.sale_start_at ?? ""}
            onChange={(e) => setForm({ ...form, sale_start_at: e.target.value })}
          />
          <Input
            label="Banner URL (optional)"
            value={form.banner_url ?? ""}
            onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as EventStatus })}
              className="rounded-md border px-3 py-2 text-sm shadow-sm"
              style={{ borderColor: "var(--border-primary)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {!editingEvent && (
            <>
              <Input label="Grid rows" type="number" min={1} max={100} required value={form.grid_rows}
                onChange={(e) => setForm({ ...form, grid_rows: Number(e.target.value) })} />
              <Input label="Seats per row" type="number" min={1} max={100} required value={form.grid_cols}
                onChange={(e) => setForm({ ...form, grid_cols: Number(e.target.value) })} />
            </>
          )}
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Description</label>
            <textarea
              rows={3}
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded-md border px-3 py-2 text-sm shadow-sm outline-none"
              style={{ borderColor: "var(--border-primary)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
            />
          </div>
          {error && (
            <p className="sm:col-span-2 rounded-md px-3 py-2 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <div className="sm:col-span-2 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={create.isPending || updateMut.isPending}>
              {editingEvent ? "Save Changes" : "Create Event"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Gallery Modal */}
      <Modal open={galleryOpen} onClose={() => setGalleryOpen(false)} title={`Gallery — ${galleryEvent?.title ?? ""}`} maxWidth="48rem">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              loading={uploadImages.isPending}
            >
              + Add Images
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {galleryImages.length} image(s)
            </span>
          </div>

          {galleryImages.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
              No images yet. Click "Add Images" to upload.
            </p>
          ) : (
            <div className="gallery-grid">
              {galleryImages.map((img) => (
                <div key={img.id} className={`gallery-item ${img.is_main ? "is-main" : ""}`}>
                  <img src={img.image_url} alt="" />
                  <div className="gallery-actions">
                    <button
                      type="button"
                      className="gallery-action-btn star"
                      title="Set as main"
                      onClick={() => setMainImage.mutate(img.id)}
                    >
                      ★
                    </button>
                    <button
                      type="button"
                      className="gallery-action-btn delete"
                      title="Delete"
                      onClick={() => { if (confirm("Delete this image?")) deleteImage.mutate(img.id); }}
                    >
                      ✕
                    </button>
                  </div>
                  {img.is_main && <span className="gallery-main-badge">Main</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
