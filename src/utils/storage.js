import { format, parseISO } from 'date-fns';
import * as api from './api.js';

const STORAGE_KEYS = {
  BP_ENTRIES: 'bp_entries',
  WEIGHT_ENTRIES: 'weight_entries',
  USER_SETTINGS: 'user_settings',
  AUTH_TOKEN: 'auth_token',
  USER_EMAIL: 'user_email',
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function isLoggedIn() {
  return !!api.getAuthToken();
}

// ─── Auth Helpers ──────────────────────────────────────────────
export function getStoredEmail() {
  return localStorage.getItem(STORAGE_KEYS.USER_EMAIL) || '';
}

export function setStoredEmail(email) {
  if (email) {
    localStorage.setItem(STORAGE_KEYS.USER_EMAIL, email);
  } else {
    localStorage.removeItem(STORAGE_KEYS.USER_EMAIL);
  }
}

// ─── BP Entries ───────────────────────────────────────────────
export function getBpEntries() {
  if (isLoggedIn()) {
    // Return promise for async usage
    return api.getBpEntries().catch(err => {
      if (err.message === 'UNAUTHORIZED') return [];
      console.error('API error, falling back to localStorage:', err);
      return getLocalBpEntries();
    });
  }
  return Promise.resolve(getLocalBpEntries());
}

function getLocalBpEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BP_ENTRIES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveBpEntry({ systolic, diastolic, pulse, context, notes, medicationTaken }) {
  const entry = {
    id: generateId(),
    date: new Date().toISOString(),
    systolic,
    diastolic,
    pulse: pulse || null,
    context: context || [],
    notes: notes || '',
    medicationTaken: medicationTaken || false,
  };
  
  if (isLoggedIn()) {
    return api.saveBpEntry({
      systolic: entry.systolic,
      diastolic: entry.diastolic,
      pulse: entry.pulse,
      context: entry.context,
      notes: entry.notes,
      medicationTaken: entry.medicationTaken,
    }).then(saved => {
      syncLocalEntriesToServer();
      return saved;
    }).catch(err => {
      console.error('API error, saving to localStorage:', err);
      // Fall back to localStorage
      const entries = getLocalBpEntries();
      entries.unshift(entry);
      localStorage.setItem(STORAGE_KEYS.BP_ENTRIES, JSON.stringify(entries));
      return entry;
    });
  }
  
  // localStorage fallback
  const entries = getLocalBpEntries();
  entries.unshift(entry);
  localStorage.setItem(STORAGE_KEYS.BP_ENTRIES, JSON.stringify(entries));
  return Promise.resolve(entry);
}

export function deleteBpEntry(id) {
  if (isLoggedIn()) {
    return api.deleteBpEntry(id).catch(err => {
      console.error('API error:', err);
    });
  }
  const entries = getLocalBpEntries().filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEYS.BP_ENTRIES, JSON.stringify(entries));
  return Promise.resolve();
}

async function syncLocalEntriesToServer() {
  const raw = localStorage.getItem(STORAGE_KEYS.BP_ENTRIES);
  if (!raw) return;
  
  const localEntries = JSON.parse(raw);
  if (localEntries.length === 0) return;
  
  try {
    const serverEntries = await api.getBpEntries();
    if (serverEntries.length > 0) {
      localStorage.removeItem(STORAGE_KEYS.BP_ENTRIES);
      return;
    }
  } catch {
    return;
  }
  
  for (const entry of localEntries) {
    try {
      await api.saveBpEntry({
        systolic: entry.systolic,
        diastolic: entry.diastolic,
        pulse: entry.pulse,
        context: entry.context,
        notes: entry.notes,
        medicationTaken: entry.medicationTaken,
        recordedAt: entry.date,
      });
    } catch {
      // Skip failed entries
    }
  }
  
  localStorage.removeItem(STORAGE_KEYS.BP_ENTRIES);
}

// ─── Weight Entries ───────────────────────────────────────────
export function getWeightEntries() {
  if (isLoggedIn()) {
    return api.getWeightEntries().catch(err => {
      if (err.message === 'UNAUTHORIZED') return [];
      console.error('API error, falling back to localStorage:', err);
      return getLocalWeightEntries();
    });
  }
  return Promise.resolve(getLocalWeightEntries());
}

function getLocalWeightEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WEIGHT_ENTRIES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveWeightEntry({ weight, notes }) {
  const entry = {
    id: generateId(),
    date: new Date().toISOString(),
    weight,
    notes: notes || '',
  };
  
  if (isLoggedIn()) {
    return api.saveWeightEntry({
      weight: entry.weight,
      notes: entry.notes,
    }).then(saved => {
      syncLocalWeightToServer();
      return saved;
    }).catch(err => {
      console.error('API error, saving to localStorage:', err);
      const entries = getLocalWeightEntries();
      entries.unshift(entry);
      localStorage.setItem(STORAGE_KEYS.WEIGHT_ENTRIES, JSON.stringify(entries));
      return entry;
    });
  }
  
  const entries = getLocalWeightEntries();
  entries.unshift(entry);
  localStorage.setItem(STORAGE_KEYS.WEIGHT_ENTRIES, JSON.stringify(entries));
  return Promise.resolve(entry);
}

export function deleteWeightEntry(id) {
  if (isLoggedIn()) {
    return api.deleteWeightEntry(id).catch(err => {
      console.error('API error:', err);
    });
  }
  const entries = getLocalWeightEntries().filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEYS.WEIGHT_ENTRIES, JSON.stringify(entries));
  return Promise.resolve();
}

async function syncLocalWeightToServer() {
  const raw = localStorage.getItem(STORAGE_KEYS.WEIGHT_ENTRIES);
  if (!raw) return;
  
  const localEntries = JSON.parse(raw);
  if (localEntries.length === 0) return;
  
  try {
    const serverEntries = await api.getWeightEntries();
    if (serverEntries.length > 0) {
      localStorage.removeItem(STORAGE_KEYS.WEIGHT_ENTRIES);
      return;
    }
  } catch {
    return;
  }
  
  for (const entry of localEntries) {
    try {
      await api.saveWeightEntry({
        weight: entry.weight,
        notes: entry.notes,
        recordedAt: entry.date,
      });
    } catch {
      // Skip failed entries
    }
  }
  
  localStorage.removeItem(STORAGE_KEYS.WEIGHT_ENTRIES);
}

// ─── Settings ──────────────────────────────────────────────────
export function getSettings() {
  if (isLoggedIn()) {
    return api.getSettings().catch(err => {
      console.error('API error, falling back to localStorage:', err);
      return getLocalSettings();
    });
  }
  return Promise.resolve(getLocalSettings());
}

function getLocalSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    return raw ? JSON.parse(raw) : { weightUnit: 'kg', bpUnit: 'mmHg' };
  } catch {
    return { weightUnit: 'kg', bpUnit: 'mmHg' };
  }
}

export function saveSettings(settings) {
  if (isLoggedIn()) {
    return api.saveSettings(settings).catch(err => {
      console.error('API error, saving to localStorage:', err);
      localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
    });
  }
  localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
  return Promise.resolve();
}

// ─── Auth ──────────────────────────────────────────────────────
export async function register(name, email) {
  const result = await api.register(name, email);
  setStoredEmail(email);
  return result;
}

export async function login(email) {
  const result = await api.login(email);
  setStoredEmail(email);
  return result;
}

export async function logout() {
  await api.logout();
  setStoredEmail(null);
}

export async function getMe() {
  return api.getMe();
}

export function isAuthenticated() {
  return isLoggedIn();
}
