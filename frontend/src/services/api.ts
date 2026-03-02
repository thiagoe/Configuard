/**
 * API Client Configuration
 * Replaces Supabase client with custom API calls
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const USER_ID_KEY = 'user_id';

export const getUserId = (): string | null => localStorage.getItem(USER_ID_KEY);
export const setUserId = (id: string): void => localStorage.setItem(USER_ID_KEY, id);
export const clearUserId = (): void => localStorage.removeItem(USER_ID_KEY);

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Token management
export const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const setTokens = (accessToken: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
};

export const clearTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  clearUserId();
};

// Request interceptor - add auth token and user identity
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const userId = getUserId();
    if (userId) {
      config.headers['X-User-Id'] = userId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - on 401, clear tokens and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearTokens();
      window.location.href = '/auth';
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
