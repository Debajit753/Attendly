import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AppData } from '../logic';
import { firebaseConfigured } from './config';
import { CloudUser, watchUser } from './auth';
import { lastSyncedAt as readLastSynced, runSync } from './sync';
import { stashBeforeReplace } from '../storage';

export type SyncStatus =
  | { state: 'off' }                         // not configured, or signed out
  | { state: 'unverified' }                  // signed in, email not verified yet
  | { state: 'idle'; lastSyncedAt?: string }
  | { state: 'syncing'; lastSyncedAt?: string }
  | { state: 'waiting'; lastSyncedAt?: string }   // conflict not answered yet
  | { state: 'error'; message: string; lastSyncedAt?: string };

export type Conflict = { summary: string; resolve: (c: 'phone' | 'cloud' | null) => void };

const DEBOUNCE_MS = 4000;

/**
 * Keeps the cloud in step with the phone while signed in and verified.
 * `ready` must be false whenever the local load failed, so nothing broken is uploaded.
 */
export function useCloudSync(data: AppData | null, setData: (u: (d: AppData | null) => AppData | null) => void, ready: boolean) {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [status, setStatus] = useState<SyncStatus>({ state: 'off' });
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const dataRef = useRef(data); dataRef.current = data;
  const running = useRef(false), again = useRef(false), last = useRef<string | undefined>(undefined);
  const enabled = !!user && user.verified && ready && firebaseConfigured;

  useEffect(() => watchUser(setUser), []);
  useEffect(() => {
    if (!user) { setStatus({ state: 'off' }); return; }
    if (!user.verified) { setStatus({ state: 'unverified' }); return; }
    readLastSynced(user.uid).then(t => { last.current = t; setStatus({ state: 'idle', lastSyncedAt: t }); });
  }, [user]);

  const ask = (summary: string) => new Promise<'phone' | 'cloud' | null>(resolve => {
    setConflict({ summary, resolve: (c) => { setConflict(null); resolve(c); } });
  });

  const syncNow = useCallback(async () => {
    if (!enabled || !user || !dataRef.current) return;
    if (running.current) { again.current = true; return; }
    running.current = true;
    setStatus({ state: 'syncing', lastSyncedAt: last.current });
    try {
      const res = await runSync(dataRef.current, user.uid, ask);
      if (res === 'waiting') setStatus({ state: 'waiting', lastSyncedAt: last.current });
      else {
        if (res.apply) {
          // Choosing "Keep cloud" replaces this phone's data: keep a one-step undo copy first.
          if (res.chose === 'cloud' && dataRef.current) await stashBeforeReplace(dataRef.current, 'cloud download');
          setData(cur => (cur ? res.apply!(cur) : cur));
        }
        last.current = new Date().toISOString();
        setStatus({ state: 'idle', lastSyncedAt: last.current });
      }
    } catch (e: any) {
      const code = String(e?.code ?? '');
      const message = code === 'permission-denied' ? 'The cloud refused the upload. Publish the latest firestore.rules, or sign out and in again.'
        : code === 'unavailable' || code.includes('network') ? "Offline. Changes will upload when you're back online."
        : 'Sync failed. It will try again.';
      setStatus({ state: 'error', message, lastSyncedAt: last.current });
    } finally {
      running.current = false;
      if (again.current) { again.current = false; setTimeout(syncNow, 500); }
    }
  }, [enabled, user]);

  // Sync when it becomes possible (sign-in, verification, app ready).
  useEffect(() => { if (enabled) syncNow(); }, [enabled, syncNow]);

  // Upload a few seconds after the last change.
  useEffect(() => {
    if (!enabled || !data) return;
    const t = setTimeout(syncNow, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [data, enabled, syncNow]);

  // Pull on return to the app; push when leaving it.
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (enabled && (st === 'active' || st === 'background')) syncNow(); });
    return () => sub.remove();
  }, [enabled, syncNow]);

  return { user, status, conflict, syncNow, setUser };
}
