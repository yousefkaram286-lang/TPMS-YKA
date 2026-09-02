// ============================================================
// TPMS — User Model
// ============================================================

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  password?: string;
  role: 'Admin' | 'User';
  displayName: string;
  active: boolean;
  email?: string;
  avatar?: string;
  department?: string;
  createdAt?: string;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}
