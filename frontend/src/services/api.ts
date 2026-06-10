/**
 * API Client Configuration
 * Replaces Supabase client with custom API calls
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// API base URL from environment
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Storage keys — sessionStorage: tokens die when the tab closes, not readable cross-tab
const ACCESS_TOKEN_KEY = 'access_token';
const USER_ID_KEY = 'user_id';

// Custom event used by the 401 interceptor to signal AuthContext without hard redirect
export const AUTH_EXPIRED_EVENT = 'auth:expired';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Token management — sessionStorage keeps tokens out of XSS-reachable persistent storage
export const getAccessToken = (): string | null => {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
};

export const setTokens = (accessToken: string, userId?: string): void => {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (userId) sessionStorage.setItem(USER_ID_KEY, userId);
};

export const clearTokens = (): void => {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(USER_ID_KEY);
};

// Request interceptor - add auth token and user identity
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      // Identity now travels inside the signed JWT — no X-User-Id header.
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - on 401, emit event so AuthContext handles cleanup + navigation
let _authExpiredDispatched = false;
api.interceptors.response.use(
  (response) => {
    _authExpiredDispatched = false;
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && !_authExpiredDispatched) {
      _authExpiredDispatched = true;
      clearTokens();
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

export default api;

// Type for API error responses
export interface ApiError {
  detail: string;
  status_code?: number;
}

// Helper to extract error message
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiError;
    return apiError?.detail || error.message || 'An error occurred';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
};
