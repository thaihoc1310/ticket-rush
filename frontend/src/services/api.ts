import { useAuthStore } from "@/store/authStore";
import type {
  LoginPayload,
  RegisterPayload,
  TokenResponse,
  User,
} from "@/types/auth";
import type {
  EventCreatePayload,
  EventListQuery,
  EventSummary,
  EventUpdatePayload,
  Venue,
  VenueCreatePayload,
  Zone,
  ZoneCreatePayload,
} from "@/types/catalog";
import type {
  Booking,
  SeatLockResponse,
  SeatWithZone,
  Ticket,
} from "@/types/booking";
import type {
  DemographicsOut,
  OccupancyOut,
  RevenuePoint,
  SummaryOut,
  TopEvent,
} from "@/types/dashboard";

const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
  }
  if (auth) {
    const token = useAuthStore.getState().accessToken;
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : response.statusText) || "Request failed";
    throw new ApiError(response.status, message, payload);
  }
  return payload as T;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    request<User>("/auth/register", { method: "POST", body: payload, auth: false }),
  login: (payload: LoginPayload) =>
    request<TokenResponse>("/auth/login", { method: "POST", body: payload, auth: false }),
  refresh: () =>
    request<TokenResponse>("/auth/refresh", { method: "POST", auth: false }),
  logout: () => request<void>("/auth/logout", { method: "POST", auth: false }),
  me: () => request<User>("/auth/me"),
};

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || v === null) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const venueApi = {
  list: () => request<Venue[]>("/venues", { auth: false }),
  get: (id: string) => request<Venue>(`/venues/${id}`, { auth: false }),
  create: (payload: VenueCreatePayload) =>
    request<Venue>("/venues", { method: "POST", body: payload }),
  update: (id: string, payload: Partial<VenueCreatePayload>) =>
    request<Venue>(`/venues/${id}`, { method: "PATCH", body: payload }),
  remove: (id: string) => request<void>(`/venues/${id}`, { method: "DELETE" }),
};

export const eventApi = {
  list: (q: EventListQuery = {}) =>
    request<EventSummary[]>(
      `/events${buildQuery({ ...q } as Record<string, string | number | boolean | undefined>)}`,
      { auth: false },
    ),
  get: (id: string) =>
    request<EventSummary>(`/events/${id}`, { auth: false }),
  create: (payload: EventCreatePayload) =>
    request<EventSummary>("/events", { method: "POST", body: payload }),
  update: (id: string, payload: EventUpdatePayload) =>
    request<EventSummary>(`/events/${id}`, { method: "PATCH", body: payload }),
  remove: (id: string) => request<void>(`/events/${id}`, { method: "DELETE" }),
};

export const zoneApi = {
  listForEvent: (eventId: string) =>
    request<Zone[]>(`/events/${eventId}/zones`, { auth: false }),
  create: (eventId: string, payload: ZoneCreatePayload) =>
    request<Zone>(`/events/${eventId}/zones`, { method: "POST", body: payload }),
  remove: (zoneId: string) =>
    request<void>(`/zones/${zoneId}`, { method: "DELETE" }),
};

export const seatApi = {
  listForEvent: (eventId: string) =>
    request<SeatWithZone[]>(`/events/${eventId}/seats`, { auth: false }),
  lock: (seatId: string) =>
    request<SeatLockResponse>(`/seats/${seatId}/lock`, { method: "POST" }),
  unlock: (seatId: string) =>
    request<SeatLockResponse>(`/seats/${seatId}/unlock`, { method: "POST" }),
};

export const bookingApi = {
  create: (eventId: string, seatIds: string[]) =>
    request<Booking>("/bookings", {
      method: "POST",
      body: { event_id: eventId, seat_ids: seatIds },
    }),
  get: (id: string) => request<Booking>(`/bookings/${id}`),
  listMine: () => request<Booking[]>("/bookings/my"),
  pay: (id: string) => request<Booking>(`/bookings/${id}/pay`, { method: "POST" }),
  cancel: (id: string) =>
    request<Booking>(`/bookings/${id}/cancel`, { method: "POST" }),
};

export const seatAdminApi = {
  bulkAssign: (eventId: string, seatIds: string[], zoneId: string | null) =>
    request<{ updated: number }>(`/events/${eventId}/seats/bulk-assign`, {
      method: "POST",
      body: { seat_ids: seatIds, zone_id: zoneId },
    }),
};

export const ticketApi = {
  listMine: () => request<Ticket[]>("/tickets/my"),
  get: (id: string) => request<Ticket>(`/tickets/${id}`),
};

export const dashboardApi = {
  summary: () => request<SummaryOut>("/dashboard/summary"),
  revenue: (days = 30) => request<RevenuePoint[]>(`/dashboard/revenue?days=${days}`),
  occupancy: (eventId: string) =>
    request<OccupancyOut>(`/dashboard/occupancy/${eventId}`),
  demographics: () => request<DemographicsOut>("/dashboard/demographics"),
  topEvents: (limit = 5) =>
    request<TopEvent[]>(`/dashboard/top-events?limit=${limit}`),
};
