import axios from 'axios';

/**
 * Normalizes the API base URL.
 * Ensures that if a backend URL is provided without '/api', '/api' is automatically appended.
 * If unset or '/api', uses '/api' for Vite dev proxy or Vercel rewrites.
 */
export function resolveApiBaseUrl(raw = import.meta.env.VITE_API_URL) {
  if (!raw || typeof raw !== 'string') return '/api';
  const clean = raw.trim().replace(/\/+$/, '');
  if (!clean || clean === '/api') return '/api';
  return clean.endsWith('/api') ? clean : `${clean}/api`;
}

const BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send HttpOnly cookies
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token if stored (fallback when cross-site cookies are restricted)
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore storage access errors in restricted contexts
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthRoute = url.includes('/auth/login') ||
                        url.includes('/auth/register') ||
                        url.includes('/auth/forgot-password') ||
                        url.includes('/auth/verify-otp') ||
                        url.includes('/auth/verify-reset-otp') ||
                        url.includes('/auth/reset-password') ||
                        url.includes('/auth/resend-otp') ||
                        url.includes('/auth/me');

    const isAuthPage = typeof window !== 'undefined' && (
      window.location.pathname === '/login' ||
      window.location.pathname === '/register' ||
      window.location.pathname === '/verify-otp' ||
      window.location.pathname === '/forgot-password' ||
      window.location.pathname === '/reset-password'
    );

    if (error.response?.status === 401 && !isAuthRoute && !isAuthPage) {
      try {
        localStorage.removeItem('auth_token');
      } catch {}
      // Token expired or revoked — redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
