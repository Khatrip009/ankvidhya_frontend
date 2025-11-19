// src/lib/scope.js
import api from './api';

let _scope = null;

export async function getScope() {
  if (_scope) return _scope;
  try {
    const { data } = await api.get('/api/auth/me');
    const role = (data.role_name || data.role || '').toLowerCase();
    _scope = {
      role,
      employee_id: data.employee_id || null,
      school_ids: Array.isArray(data.school_ids) ? data.school_ids : (data.school_id ? [data.school_id] : []),
    };
    return _scope;
  } catch {
    _scope = { role: 'guest', employee_id: null, school_ids: [] };
    return _scope;
  }
}

export default { getScope };
