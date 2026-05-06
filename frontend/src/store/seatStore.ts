import { create } from "zustand";

import type { SeatWithZone } from "@/types/booking";

/** Seconds a seat is held during seat-selection phase (must match backend). */
export const SEAT_LOCK_TTL = 60; // 1 min for demo

interface SeatState {
  seats: Record<string, SeatWithZone>;
  selectedIds: string[];
  /** Map seat_id → ISO locked_at timestamp (from server) */
  lockTimers: Record<string, string>;
  setAll: (seats: SeatWithZone[]) => void;
  applyUpdate: (
    id: string,
    patch: Partial<Pick<SeatWithZone, "status" | "locked_by">>,
  ) => void;
  toggleSelect: (id: string) => void;
  setSelected: (ids: string[]) => void;
  setLockTime: (id: string, lockedAt: string) => void;
  removeLockTime: (id: string) => void;
  clear: () => void;
}

export const useSeatStore = create<SeatState>((set) => ({
  seats: {},
  selectedIds: [],
  lockTimers: {},
  setAll: (seats) =>
    set(() => ({
      seats: Object.fromEntries(seats.map((s) => [s.id, s])),
    })),
  applyUpdate: (id, patch) =>
    set((state) => {
      const existing = state.seats[id];
      if (!existing) return state;
      const updated = { ...existing, ...patch };
      const result: Partial<SeatState> = {
        seats: { ...state.seats, [id]: updated },
      };
      // If the seat became AVAILABLE, auto-remove from selection & timers.
      if (patch.status === "AVAILABLE") {
        result.selectedIds = state.selectedIds.filter((x) => x !== id);
        const { [id]: _, ...rest } = state.lockTimers;
        result.lockTimers = rest;
      }
      return result;
    }),
  toggleSelect: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((x) => x !== id)
        : [...state.selectedIds, id],
    })),
  setSelected: (ids) => set({ selectedIds: ids }),
  setLockTime: (id, lockedAt) =>
    set((state) => ({
      lockTimers: { ...state.lockTimers, [id]: lockedAt },
    })),
  removeLockTime: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.lockTimers;
      return { lockTimers: rest };
    }),
  clear: () => set({ seats: {}, selectedIds: [], lockTimers: {} }),
}));
