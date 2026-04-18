export type Role = "CUSTOMER" | "ADMIN";
export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface User {
  id: string;
  email: string;
  full_name: string;
  date_of_birth: string | null;
  gender: Gender | null;
  role: Role;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  date_of_birth?: string | null;
  gender?: Gender | null;
}
