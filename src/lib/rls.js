// src/lib/rls.js
import api from './api';

const role = () => (localStorage.getItem('role') || '').toLowerCase();
const isScoped = () => ['faculty', 'team_leader', 'school_admin'].includes(role());

export async function visibleSchools() {
  if (isScoped()) {
    const { data } = await api.get('/api/me/schools').catch(() => ({ data: [] }));
    return data || [];
  } else {
    const { data } = await api.get('/api/schools', { query: { pageSize: 1000 } }).catch(() => ({ data: [] }));
    return data || [];
  }
}

export async function visibleClasses() {
  if (!isScoped()) return [];
  const { data } = await api.get('/api/me/classes').catch(() => ({ data: [] }));
  return data || [];
}

export function unique(arr, by) {
  const s = new Set();
  return (arr||[]).filter(x => {
    const k = by(x);
    if (k == null || s.has(k)) return false;
    s.add(k);
    return true;
  });
}

export default { role, isScoped, visibleSchools, visibleClasses, unique };
