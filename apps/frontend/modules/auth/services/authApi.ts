import { http } from '@/shared/api/http';

export interface AuthStatus {
  authRequired: boolean;
  authenticated: boolean;
}

export interface LoginResult {
  token: string;
  expiresInHours: number;
}

export const authApi = {
  getStatus: () => http<AuthStatus>('/api/auth/status'),
  login: (username: string, password: string) =>
    http<LoginResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
};
