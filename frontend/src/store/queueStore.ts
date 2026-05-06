import { create } from "zustand";

import type { QueueStatus } from "@/types/queue";

interface QueueState {
  status: QueueStatus | "IDLE" | "CHECKING";
  position: number | null;
  queueSize: number;
  accessToken: string | null;
  eventId: string | null;

  setChecking: () => void;
  setStatus: (status: QueueStatus) => void;
  setPosition: (position: number | null, queueSize: number) => void;
  setGranted: (accessToken: string) => void;
  setEventId: (eventId: string) => void;
  reset: () => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  status: "IDLE",
  position: null,
  queueSize: 0,
  accessToken: null,
  eventId: null,

  setChecking: () => set({ status: "CHECKING" }),
  setStatus: (status) => set({ status }),
  setPosition: (position, queueSize) => set({ position, queueSize }),
  setGranted: (accessToken) =>
    set({ status: "GRANTED", accessToken, position: null }),
  setEventId: (eventId) => set({ eventId }),
  reset: () =>
    set({
      status: "IDLE",
      position: null,
      queueSize: 0,
      accessToken: null,
      eventId: null,
    }),
}));
