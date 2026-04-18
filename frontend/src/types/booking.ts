export type SeatStatus = "AVAILABLE" | "LOCKED" | "SOLD";
export type BookingStatus = "PENDING" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED";
export type TicketStatus = "VALID" | "USED" | "CANCELLED";

export interface SeatWithZone {
  id: string;
  event_id: string;
  zone_id: string | null;
  zone_name: string | null;
  zone_color: string | null;
  price: string | null;
  row_number: number;
  seat_number: number;
  status: SeatStatus;
  locked_by: string | null;
}

export interface SeatLockResponse {
  seat_id: string;
  status: SeatStatus;
  expires_in: number;
}

export interface BookingItem {
  id: string;
  seat_id: string;
  row_number: number;
  seat_number: number;
  zone_name: string;
  price: string;
}

export interface Payment {
  id: string;
  amount: string;
  method: string;
  status: PaymentStatus;
  paid_at: string | null;
}

export interface Booking {
  id: string;
  event_id: string;
  event_title: string;
  event_date: string;
  status: BookingStatus;
  total_amount: string;
  created_at: string;
  expires_at: string;
  items: BookingItem[];
  payment: Payment | null;
}

export interface Ticket {
  id: string;
  booking_item_id: string;
  qr_data: string;
  qr_image: string;
  status: TicketStatus;
  issued_at: string;
  event_title: string;
  event_date: string;
  zone_name: string;
  row_number: number;
  seat_number: number;
}

export interface SeatUpdateMessage {
  type: "seat_update";
  seat_id: string;
  zone_id: string | null;
  row_number: number;
  seat_number: number;
  status: SeatStatus;
  locked_by: string | null;
}
