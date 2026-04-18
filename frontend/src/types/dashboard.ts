export interface SummaryOut {
  total_revenue: string;
  confirmed_bookings: number;
  total_tickets: number;
  registered_users: number;
  upcoming_events: number;
  published_events: number;
}

export interface RevenuePoint {
  date: string;
  revenue: string;
  bookings: number;
}

export interface OccupancyZone {
  zone_id: string;
  name: string;
  color: string;
  total: number;
  sold: number;
  locked: number;
  available: number;
}

export interface OccupancyOut {
  event_id: string;
  event_title: string;
  event_date: string;
  total_seats: number;
  sold: number;
  locked: number;
  available: number;
  unassigned: number;
  by_zone: OccupancyZone[];
}

export interface GenderBucket {
  gender: string;
  count: number;
}

export interface AgeBucket {
  bracket: string;
  count: number;
}

export interface DemographicsOut {
  by_gender: GenderBucket[];
  by_age: AgeBucket[];
  total: number;
}

export interface TopEvent {
  event_id: string;
  title: string;
  event_date: string;
  tickets: number;
  revenue: string;
}
