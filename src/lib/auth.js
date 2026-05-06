// src/lib/auth.js
import api from './api';

const TOKEN_KEY = 'token';
const USER_KEY  = 'user';
const ROLE_KEY  = 'role';
const PERMS_KEY = 'permissions';

/* ---------- Internal token cache (sync) ---------- */
let _token = '';
try {
  _token = localStorage.getItem(TOKEN_KEY) || '';
} catch {
  _token = '';
}

/* ---------- Public helpers ---------- */

export function getToken() {
  // Return cached token; fallback to localStorage
  return _token || (() => {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  })();
}

export function setToken(t) {
  _token = t || '';
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage disabled or full – ignore
  }
}

export function isAuthed() {
  return !!getToken();
}

/* ---------- Session persistence ---------- */
export function setSession(me) {
  if (!me) return;

  const roleName = (me.role_name || me.role || '').toString().toLowerCase();

  // Store everything in localStorage
  try {
    localStorage.setItem(ROLE_KEY, roleName);
    localStorage.setItem(USER_KEY, JSON.stringify(me));
    if (me.permissions) localStorage.setItem(PERMS_KEY, JSON.stringify(me.permissions));
  } catch {
    // Silent – storage not critical here
  }

  // Notify the entire app that the user has changed
  try {
    window.dispatchEvent(
      new CustomEvent('auth:changed', { detail: { user: me } })
    );
  } catch {
    // Event system may not be available (non‑browser)
  }
}

/* ---------- Load current user ---------- */
export async function loadMe() {
  const token = getToken();
  if (!token) throw new Error('No authentication token found');

  // Try alternative endpoints (some deployments may use different paths)
  const endpoints = [
    '/api/auth/me',
    '/auth/me',
    '/api/me',
    '/me',
  ];
  let lastErr = null;

  for (const ep of endpoints) {
    try {
      const res = await api.get(ep);
      const data = res?.data ?? res;   // normalize
      if (data && data.user_id) {
        setSession(data);
        return data;
      }
    } catch (err) {
      lastErr = err;
      // Continue to next endpoint
    }
  }

  // All endpoints failed – clear local session to avoid stale state
  logout();
  throw lastErr || new Error('Unable to load user session');
}

/* ---------- Logout ---------- */
export function logout() {
  setToken('');                     // clear token cache + localStorage
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(PERMS_KEY);
  } catch {
    // Silent
  }

  // Notify that the user is now logged out
  try {
    window.dispatchEvent(
      new CustomEvent('auth:changed', { detail: { user: null } })
    );
  } catch {
    // Silent (non‑browser environment)
  }
}

/* ---------- Default export (optional) ---------- */
export default {
  getToken,
  setToken,
  isAuthed,
  setSession,
  loadMe,
  logout,
};