export type QueueStatus = "GRANTED" | "WAITING" | "INACTIVE";

export interface QueueConfigIn {
  max_concurrent: number;
  enabled: boolean;
  session_ttl_seconds: number;
}

export interface QueueConfigOut {
  event_id: string;
  max_concurrent: number;
  enabled: boolean;
  current_active: number;
  queue_length: number;
  session_ttl_seconds: number;
}

export interface QueueJoinOut {
  status: QueueStatus;
  position: number | null;
  queue_size: number;
  access_token: string | null;
  session_ttl_seconds: number | null;
  granted_at: number | null;
}

export interface QueueStatusOut {
  status: QueueStatus;
  position: number | null;
  queue_size: number;
  access_token: string | null;
  session_ttl_seconds: number | null;
  granted_at: number | null;
}

export interface QueueGrantMessage {
  type: "queue_grant";
  user_id: string;
  event_id: string;
  access_token: string;
  session_ttl_seconds: number;
  granted_at: number;
}

export interface QueueSessionExpiredMessage {
  type: "session_expired";
  user_id: string;
  event_id: string;
}

export interface QueueAdminUpdateMessage {
  type: "queue_admin_update";
  event_id: string;
}

export interface QueueUser {
  user_id: string;
  email: string;
  full_name: string;
  granted_at: number | null;
  joined_at: number | null;
  position: number | null;
}

export interface QueueUsersOut {
  granted: QueueUser[];
  waiting: QueueUser[];
}
