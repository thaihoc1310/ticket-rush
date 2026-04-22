export type EventStatus = "DRAFT" | "PUBLISHED" | "ENDED";

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity: number;
}

export interface VenueCreatePayload {
  name: string;
  address: string;
  city: string;
  capacity: number;
}

export interface EventImage {
  id: string;
  image_url: string;
  is_main: boolean;
  display_order: number;
}

export interface EventSummary {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  sale_start_at: string | null;
  banner_url: string | null;
  status: EventStatus;
  venue: Venue;
  grid_rows: number;
  grid_cols: number;
  images: EventImage[];
}

export interface EventCreatePayload {
  venue_id: string;
  title: string;
  description?: string | null;
  event_date: string;
  sale_start_at?: string | null;
  banner_url?: string | null;
  status?: EventStatus;
  grid_rows: number;
  grid_cols: number;
}

export interface EventUpdatePayload extends Partial<EventCreatePayload> {}

export interface Zone {
  id: string;
  event_id: string;
  name: string;
  price: string;
  color: string;
  seat_count: number;
}

export interface ZoneCreatePayload {
  name: string;
  price: string;
  color: string;
}

export interface EventListQuery {
  q?: string;
  city?: string;
  status?: EventStatus;
  upcoming?: boolean;
  limit?: number;
  offset?: number;
}

export interface PaymentAdmin {
  id: string;
  booking_id: string;
  amount: string;
  method: string;
  status: string;
  paid_at: string | null;
  user_email: string | null;
  event_title: string | null;
  booking_status: string | null;
}
