const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:38257/api';

let authToken = localStorage.getItem('auth_token');

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function getAuthToken() {
  return authToken;
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (authToken) {
    headers['x-auth-token'] = authToken;
  }
  
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (res.status === 401) {
    setAuthToken(null);
    throw new Error('UNAUTHORIZED');
  }
  
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    if (data.error === 'PASSWORD_RESET_REQUIRED') {
      throw new Error('PASSWORD_RESET_REQUIRED');
    }
    throw new Error(data.error || 'Forbidden');
  }
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  
  return res.json();
}

// ─── Auth ───────────────────────────────────────────────────────
export async function register({ name, email, password, gender, yearOfBirth, mobile }) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, gender, yearOfBirth, mobile }),
  });
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function login(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function forgotPassword(email) {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function changePassword(currentPassword, newPassword) {
  return request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function resetPassword(newPassword) {
  return request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' });
  } finally {
    setAuthToken(null);
  }
}

export async function getMe() {
  return request('/auth/me');
}

export async function updateProfile({ name, mobile }) {
  return request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({ name, mobile }),
  });
}

// ─── Audit ─────────────────────────────────────────────────────
export async function getAuditLogs({ action, limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit, offset });
  if (action) params.append('action', action);
  return request(`/audit?${params.toString()}`);
}

// ─── BP Entries ───────────────────────────────────────────────
export async function getBpEntries() {
  return request('/bp');
}

export async function saveBpEntry(entry) {
  return request('/bp', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function deleteBpEntry(id) {
  return request(`/bp/${id}`, { method: 'DELETE' });
}

// ─── Weight Entries ───────────────────────────────────────────
export async function getWeightEntries() {
  return request('/weight');
}

export async function saveWeightEntry(entry) {
  return request('/weight', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function deleteWeightEntry(id) {
  return request(`/weight/${id}`, { method: 'DELETE' });
}

// ─── Settings ──────────────────────────────────────────────────
export async function getSettings() {
  return request('/settings');
}

export async function saveSettings(settings) {
  return request('/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

// ─── Stats ─────────────────────────────────────────────────────
export async function getStats() {
  return request('/stats');
}