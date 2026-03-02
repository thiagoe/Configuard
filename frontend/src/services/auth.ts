/**
 * Authentication Service
 * Handles login and logout using a static API token
 */

import api, { setTokens, clearTokens, setUserId, getErrorMessage } from './api';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'moderator' | 'user';
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  user: User;
}

/**
 * Login user with email and password
 */
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/login', credentials);
  const { access_token, user } = response.data;
  setTokens(access_token);
  if (user?.id) {
    setUserId(user.id);
  }
  return response.data;
};

/**
 * Logout current user
 */
export const logout = async (): Promise<void> => {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    // Ignore errors on logout
    console.error('Logout error:', getErrorMessage(error));
  } finally {
    clearTokens();
  }
};

/**
 * Get current user profile
 */
export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get<User>('/users/me');
  return response.data;
};

/**
 * Update current user profile
 */
export const updateProfile = async (data: Partial<User>): Promise<User> => {
  const response = await api.put<User>('/users/me', data);
  return response.data;
};

/**
 * Check if user is authenticated (has valid token)
 */
export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem('access_token');
  return !!token;
};
