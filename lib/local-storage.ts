/**
 * localStorage fallback for when Supabase is unavailable (paused/unreachable).
 * Stores daily entries and egg grades locally, with a pending sync queue.
 */

const STORAGE_KEYS = {
  COOPS: "egg-tracker-coops",
  DAILY_ENTRIES: "egg-tracker-daily-entries",
  EGG_GRADES: "egg-tracker-egg-grades",
  PENDING_SYNC: "egg-tracker-pending-sync",
  OFFLINE_MODE: "egg-tracker-offline-mode",
} as const

// Default coops when Supabase is unavailable and no cached coops exist
const DEFAULT_COOPS = [
  { id: "coop-1", name: "Coop 1", display_order: 1, created_at: new Date().toISOString() },
  { id: "coop-2", name: "Coop 2", display_order: 2, created_at: new Date().toISOString() },
  { id: "coop-3", name: "Coop 3", display_order: 3, created_at: new Date().toISOString() },
  { id: "coop-4", name: "Coop 4", display_order: 4, created_at: new Date().toISOString() },
]

export interface LocalDailyEntry {
  entry_date: string
  coop_id: string
  age: number | null
  number_of_chickens: number
  dead_chickens: number
  balance_stock: number
  egg_boxes: number
  broken_eggs: number
  production_rate: number
  remarks: string | null
  updated_at: string
}

export interface LocalEggGrade {
  entry_date: string
  grade: string
  boxes: number
  pieces: number
  percentage: number
  updated_at: string
}

export interface PendingSyncItem {
  type: "daily_entry" | "egg_grade"
  data: LocalDailyEntry | LocalEggGrade
  timestamp: string
}

function safeGetItem<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : fallback
  } catch {
    return fallback
  }
}

function safeSetItem(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error("localStorage write failed:", e)
  }
}

// Coops
export function getCachedCoops() {
  return safeGetItem(STORAGE_KEYS.COOPS, DEFAULT_COOPS)
}

export function setCachedCoops(coops: unknown[]) {
  safeSetItem(STORAGE_KEYS.COOPS, coops)
}

// Daily Entries
export function getLocalDailyEntries(entryDate: string): LocalDailyEntry[] {
  const all = safeGetItem<LocalDailyEntry[]>(STORAGE_KEYS.DAILY_ENTRIES, [])
  return all.filter((e) => e.entry_date === entryDate)
}

export function saveLocalDailyEntry(entry: LocalDailyEntry): void {
  const all = safeGetItem<LocalDailyEntry[]>(STORAGE_KEYS.DAILY_ENTRIES, [])
  const idx = all.findIndex(
    (e) => e.entry_date === entry.entry_date && e.coop_id === entry.coop_id
  )
  if (idx >= 0) {
    all[idx] = entry
  } else {
    all.push(entry)
  }
  safeSetItem(STORAGE_KEYS.DAILY_ENTRIES, all)
}

// Egg Grades
export function getLocalEggGrades(entryDate: string): LocalEggGrade[] {
  const all = safeGetItem<LocalEggGrade[]>(STORAGE_KEYS.EGG_GRADES, [])
  return all.filter((e) => e.entry_date === entryDate)
}

export function saveLocalEggGrade(grade: LocalEggGrade): void {
  const all = safeGetItem<LocalEggGrade[]>(STORAGE_KEYS.EGG_GRADES, [])
  const idx = all.findIndex(
    (e) => e.entry_date === grade.entry_date && e.grade === grade.grade
  )
  if (idx >= 0) {
    all[idx] = grade
  } else {
    all.push(grade)
  }
  safeSetItem(STORAGE_KEYS.EGG_GRADES, all)
}

// Pending Sync Queue
export function addToPendingSync(item: PendingSyncItem): void {
  const queue = safeGetItem<PendingSyncItem[]>(STORAGE_KEYS.PENDING_SYNC, [])
  queue.push(item)
  safeSetItem(STORAGE_KEYS.PENDING_SYNC, queue)
}

export function getPendingSyncQueue(): PendingSyncItem[] {
  return safeGetItem<PendingSyncItem[]>(STORAGE_KEYS.PENDING_SYNC, [])
}

export function clearPendingSyncQueue(): void {
  safeSetItem(STORAGE_KEYS.PENDING_SYNC, [])
}

export function getPendingSyncCount(): number {
  return getPendingSyncQueue().length
}

// Offline mode flag
export function isOfflineMode(): boolean {
  return safeGetItem(STORAGE_KEYS.OFFLINE_MODE, false)
}

export function setOfflineMode(offline: boolean): void {
  safeSetItem(STORAGE_KEYS.OFFLINE_MODE, offline)
}

// Get all local daily entries (for reports in offline mode)
export function getAllLocalDailyEntries(): LocalDailyEntry[] {
  return safeGetItem<LocalDailyEntry[]>(STORAGE_KEYS.DAILY_ENTRIES, [])
}

export function getAllLocalEggGrades(): LocalEggGrade[] {
  return safeGetItem<LocalEggGrade[]>(STORAGE_KEYS.EGG_GRADES, [])
}
