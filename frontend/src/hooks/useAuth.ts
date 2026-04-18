import { useCallback, useEffect } from "react";

import { ApiError, authApi } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import type { LoginPayload, RegisterPayload } from "@/types/auth";

// Module-level guard: bootstrap must run once across the whole app, not once
// per `useAuth()` caller. Without this, multiple components (AppShell +
// ProtectedRoute + page) each set status="loading" on mount, which causes
// ProtectedRoute to unmount the page → remount → re-bootstrap → infinite loop.
let bootstrapStarted = false;

async function bootstrapAuth() {
  const {
    accessToken,
    setToken,
    setUser,
    setStatus,
    clear,
  } = useAuthStore.getState();

  setStatus("loading");

  const loadMe = async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clear();
      } else {
        setStatus("unauthenticated");
      }
    }
  };

  if (accessToken) {
    await loadMe();
    return;
  }

  try {
    const tokens = await authApi.refresh();
    setToken(tokens.access_token);
    await loadMe();
  } catch {
    setStatus("unauthenticated");
  }
}

export function useAuth() {
  const { user, status, accessToken, setToken, setUser, setStatus, clear } =
    useAuthStore();

  useEffect(() => {
    if (bootstrapStarted) return;
    bootstrapStarted = true;
    void bootstrapAuth();
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clear();
      } else {
        setStatus("unauthenticated");
      }
    }
  }, [clear, setStatus, setUser]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setStatus("loading");
      const tokens = await authApi.login(payload);
      setToken(tokens.access_token);
      await loadMe();
    },
    [loadMe, setStatus, setToken],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await authApi.register(payload);
      await login({ email: payload.email, password: payload.password });
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clear();
    }
  }, [clear]);

  return { user, status, accessToken, login, register, logout };
}
