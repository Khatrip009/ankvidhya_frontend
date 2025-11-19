// src/lib/auth.js
// Thin wrapper stateful auth ported from public/js/auth.js (React-friendly, emits auth:changed)

import api from './api';

const KEY = 'token';
let _token = '';

try { _token = localStorage.getItem(KEY) || ''; } catch (e) { _token = ''; }

export function getToken() { return _token || (localStorage.getItem(KEY) || '') || ''; }

export function setToken(t) {
  _token = t || '';
  try {
    if (t) localStorage.setItem(KEY, t);
    else localStorage.removeItem(KEY);
  } catch (e) { /* ignore */ }
}

/* returns boolean */
export function isAuthed() { return !!getToken(); }

/* persist session data and notify app (auth:changed) */
export function setSession(me) {
  if (!me) return;
  const roleName = (me.role_name || me.role || '').toString().toLowerCase();
  try {
    localStorage.setItem('role', roleName);
    localStorage.setItem('user', JSON.stringify(me));
    if (me.permissions) localStorage.setItem('permissions', JSON.stringify(me.permissions));
    const el = document.getElementById('topProfileName');
    if (el) el.textContent = me.username || me.employee_name || me.student_name || 'Profile';
    const perms = JSON.parse(localStorage.getItem('permissions') || '[]');
    if (window.renderSidebar) window.renderSidebar({ role: roleName || 'faculty', permissions: perms });
  } catch (e) { /* ignore */ }

  // Notify the app in the same tab that auth changed
  try {
    const ev = new CustomEvent('auth:changed', { detail: { user: me } });
    window.dispatchEvent(ev);
  } catch (e) { /* ignore */ }
}

/* helper to extract payload shapes */
function extract(res) {
  if (!res) return null;
  if (res.data) return res.data;
  return res;
}

export async function loadMe() {
  const token = getToken();
  if (!token) throw new Error('No token');

  const endpoints = ['/api/auth/me', '/auth/me', '/api/me', '/me'];
  let lastErr = null;
  for (const ep of endpoints) {
    try {
      const res = await api.get(ep);
      const data = extract(res);
      if (data) {
        setSession(data);
        return data;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Failed to load session');
}

/*
  logout: clear token & session locally, and notify the app.
  Do NOT do any location.hash redirect here — React handles navigation.
*/
export function logout() {
  setToken('');
  try { localStorage.removeItem('user'); } catch {}
  try { localStorage.removeItem('role'); } catch {}
  try { localStorage.removeItem('permissions'); } catch {}

  // notify listeners in same tab that auth changed (session cleared)
  try {
    const ev = new CustomEvent('auth:changed', { detail: { user: null } });
    window.dispatchEvent(ev);
  } catch (e) { /* ignore */ }
}

export default {
  getToken,
  setToken,
  isAuthed,
  setSession,
  loadMe,
  logout,
};
