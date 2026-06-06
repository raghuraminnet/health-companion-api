const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  
  return res.json();
}

// ─── Auth ───────────────────────────────────────────────────────
export async function register(name, email) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email }),
  });
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function login(email) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  if (data.token) setAuthToken(data.token);
  return data;
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
