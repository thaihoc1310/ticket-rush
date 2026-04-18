import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User } from "@/types/auth";

interface AuthState {
  accessToken: string | null;
  user: User | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  setStatus: (status: AuthState["status"]) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      status: "idle",
      setToken: (accessToken) => set({ accessToken }),
      setUser: (user) =>
        set({ user, status: user ? "authenticated" : "unauthenticated" }),
      setStatus: (status) => set({ status }),
      clear: () =>
        set({ accessToken: null, user: null, status: "unauthenticated" }),
    }),
    {
      name: "ticketrush.auth",
      partialize: (state) => ({ accessToken: state.accessToken }),
    },
  ),
);
