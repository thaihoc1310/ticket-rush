import { create } from "zustand";

import type { SeatWithZone } from "@/types/booking";

interface SeatState {
  seats: Record<string, SeatWithZone>;
  selectedIds: string[];
  setAll: (seats: SeatWithZone[]) => void;
  applyUpdate: (
    id: string,
    patch: Partial<Pick<SeatWithZone, "status" | "locked_by">>,
  ) => void;
  toggleSelect: (id: string) => void;
  setSelected: (ids: string[]) => void;
  clear: () => void;
}

export const useSeatStore = create<SeatState>((set) => ({
  seats: {},
  selectedIds: [],
  setAll: (seats) =>
    set(() => ({
      seats: Object.fromEntries(seats.map((s) => [s.id, s])),
    })),
  applyUpdate: (id, patch) =>
    set((state) => {
      const existing = state.seats[id];
      if (!existing) return state;
      return {
        seats: { ...state.seats, [id]: { ...existing, ...patch } },
      };
    }),
  toggleSelect: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((x) => x !== id)
        : [...state.selectedIds, id],
    })),
  setSelected: (ids) => set({ selectedIds: ids }),
  clear: () => set({ seats: {}, selectedIds: [] }),
}));
