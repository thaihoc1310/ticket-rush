export type EventStatus = "DRAFT" | "PUBLISHED" | "ENDED";

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  grid_rows: number;
  grid_cols: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export interface VenueCreatePayload {
  name: string;
  address: string;
  city: string;
  grid_rows: number;
  grid_cols: number;
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
  category: string | null;
  max_tickets_per_user: number;
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
  category?: string | null;
  max_tickets_per_user?: number;
}

export type EventUpdatePayload = Partial<EventCreatePayload>;

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
  cities?: string;
  status?: EventStatus;
  date_from?: string;
  date_to?: string;
  price_min?: number;
  price_max?: number;
  categories?: string;
  limit?: number;
  offset?: number;
}

export interface FilterMeta {
  min_price: number;
  max_price: number;
  cities: string[];
  categories: string[];
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
