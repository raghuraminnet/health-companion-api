import { format, parseISO } from 'date-fns'

const STORAGE_KEYS = {
  BP_ENTRIES: 'bp_entries',
  WEIGHT_ENTRIES: 'weight_entries',
  USER_SETTINGS: 'user_settings',
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// ─── BP Entries ───────────────────────────────────────────────

export function getBpEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BP_ENTRIES)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveBpEntry({ systolic, diastolic, pulse, context, notes, medicationTaken }) {
  const entries = getBpEntries()
  const entry = {
    id: generateId(),
    date: new Date().toISOString(),
    systolic,
    diastolic,
    pulse: pulse || null,
    context: context || [],
    notes: notes || '',
    medicationTaken: medicationTaken || false,
  }
  entries.unshift(entry)
  localStorage.setItem(STORAGE_KEYS.BP_ENTRIES, JSON.stringify(entries))
  return entry
}

export function deleteBpEntry(id) {
  const entries = getBpEntries().filter(e => e.id !== id)
  localStorage.setItem(STORAGE_KEYS.BP_ENTRIES, JSON.stringify(entries))
}

// ─── Weight Entries ───────────────────────────────────────────

export function getWeightEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WEIGHT_ENTRIES)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveWeightEntry({ weight, notes }) {
  const entries = getWeightEntries()
  const entry = {
    id: generateId(),
    date: new Date().toISOString(),
    weight,
    notes: notes || '',
  }
  entries.unshift(entry)
  localStorage.setItem(STORAGE_KEYS.WEIGHT_ENTRIES, JSON.stringify(entries))
  return entry
}

export function deleteWeightEntry(id) {
  const entries = getWeightEntries().filter(e => e.id !== id)
  localStorage.setItem(STORAGE_KEYS.WEIGHT_ENTRIES, JSON.stringify(entries))
}

// ─── Settings ──────────────────────────────────────────────────

export function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS)
    return raw ? JSON.parse(raw) : { weightUnit: 'kg', bpUnit: 'mmHg' }
  } catch {
    return { weightUnit: 'kg', bpUnit: 'mmHg' }
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings))
}
