import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData } from './logic';
import { validateAppData } from './cloud/validate';

/* On-device storage. The main rule: a failed or damaged load is reported, never
   treated as "no data", so nothing can overwrite the saved copy by accident. */

export const STORE_KEY = 'bunksmart:data';                 // kept for existing installs (geofence task reads it too)
const STASH_KEY = 'bunksmart:data:before-replace';         // one-step undo for restore / reset / erase
const DAMAGED_PREFIX = 'bunksmart:data:damaged-';          // damaged copies are kept, not deleted

export type Loaded =
  | { kind: 'empty' }
  | { kind: 'ok'; data: AppData; dropped: number }
  | { kind: 'error'; raw: string | null; message: string };

export async function loadData(): Promise<Loaded> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(STORE_KEY);
  } catch {
    return { kind: 'error', raw: null, message: "Attendly couldn't read its storage on this phone." };
  }
  if (raw == null) return { kind: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'error', raw, message: 'Your saved data is damaged and could not be opened.' };
  }
  const checked = validateAppData(parsed);
  if (!checked.ok) return { kind: 'error', raw, message: `Your saved data could not be read: ${checked.error}` };
  return { kind: 'ok', data: checked.data, dropped: checked.dropped };
}

export async function saveData(data: AppData): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Keep a damaged copy under its own key before the user starts fresh. */
export async function keepDamaged(raw: string): Promise<void> {
  await AsyncStorage.setItem(DAMAGED_PREFIX + Date.now(), raw);
}

/** Save the current data so a restore, reset or erase can be undone once. */
export async function stashBeforeReplace(data: AppData, reason: string): Promise<void> {
  await AsyncStorage.setItem(STASH_KEY, JSON.stringify({ at: new Date().toISOString(), reason, data }));
}

export async function readStash(): Promise<{ at: string; reason: string; data: AppData } | null> {
  try {
    const raw = await AsyncStorage.getItem(STASH_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const checked = validateAppData(s?.data);
    return checked.ok ? { at: String(s.at), reason: String(s.reason ?? 'change'), data: checked.data } : null;
  } catch {
    return null;
  }
}

export async function clearStash(): Promise<void> {
  try { await AsyncStorage.removeItem(STASH_KEY); } catch { /* ignore */ }
}
