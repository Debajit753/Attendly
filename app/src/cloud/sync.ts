import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDoc, getDocs, writeBatch, serverTimestamp, Firestore } from 'firebase/firestore';
import { AppData, uid as newId } from '../logic';
import { cloud } from './firebase';
import { Docs, Hashes, Plan, applyRemote, planSync, readRemoteDoc, resolveConflicts, splitDocs } from './syncCore';

/* Network side of sync. Paths match firestore.rules:
     users/{uid}/data/core        users/{uid}/months/{YYYY-MM}                     */

const META_KEY = (uid: string) => `attendly:sync:${uid}`;
const DEVICE_KEY = 'attendly:deviceId';
const LOCATIONS_KEY = 'attendly:sync:locations';

type Meta = { base: Hashes; lastSyncedAt?: string };

async function readMeta(uid: string): Promise<Meta | null> {
  try { const raw = await AsyncStorage.getItem(META_KEY(uid)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
async function writeMeta(uid: string, meta: Meta) { await AsyncStorage.setItem(META_KEY(uid), JSON.stringify(meta)); }

async function deviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id) { id = 'd' + newId(); await AsyncStorage.setItem(DEVICE_KEY, id); }
  return id.slice(0, 64);
}

export async function getSyncLocations(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(LOCATIONS_KEY)) !== 'false'; } catch { return true; }
}
export async function setSyncLocations(on: boolean) { await AsyncStorage.setItem(LOCATIONS_KEY, on ? 'true' : 'false'); }

export async function lastSyncedAt(uid: string): Promise<string | undefined> { return (await readMeta(uid))?.lastSyncedAt; }

const coreRef = (db: Firestore, uid: string) => doc(db, 'users', uid, 'data', 'core');
const monthsCol = (db: Firestore, uid: string) => collection(db, 'users', uid, 'months');

async function fetchRemote(db: Firestore, uid: string): Promise<Docs> {
  const docs: Docs = {};
  const core = await getDoc(coreRef(db, uid));
  if (core.exists()) { const d = readRemoteDoc('core', core.data()); if (d) docs.core = d; }
  const months = await getDocs(monthsCol(db, uid));
  months.forEach(m => { const d = readRemoteDoc(m.id, m.data()); if (d) docs[m.id] = d; });
  return docs;
}

async function commit(db: Firestore, uid: string, local: Docs, plan: Plan) {
  const device = await deviceId();
  const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
  for (const id of plan.push) {
    const ref = id === 'core' ? coreRef(db, uid) : doc(monthsCol(db, uid), id);
    ops.push(b => b.set(ref, { ...local[id], updatedAt: serverTimestamp(), deviceId: device }));
  }
  for (const id of plan.deleteRemote) {
    const ref = id === 'core' ? coreRef(db, uid) : doc(monthsCol(db, uid), id);
    ops.push(b => b.delete(ref));
  }
  for (let i = 0; i < ops.length; i += 400) {          // Firestore batches cap at 500 writes
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach(op => op(b));
    await b.commit();
  }
}

export type SyncResult = {
  pushed: number; pulled: number;
  /** Set when a conflict was settled by the user. */
  chose?: 'phone' | 'cloud';
  /** Apply downloaded changes onto the latest local data (it may have changed meanwhile). */
  apply?: (current: AppData) => AppData;
};

/**
 * One sync pass. `ask` is called only if the phone and the cloud both changed the same
 * data; returning null leaves everything as it is and tries again later.
 */
export async function runSync(
  data: AppData, uid: string,
  ask: (summary: string) => Promise<'phone' | 'cloud' | null>,
): Promise<SyncResult | 'waiting'> {
  const c = cloud();
  if (!c) throw new Error('Cloud is not set up');
  const syncLocations = await getSyncLocations();
  const meta = await readMeta(uid);
  const local = splitDocs(data, { syncLocations });
  const remote = await fetchRemote(c.db, uid);
  let plan = planSync(local, remote, meta?.base);
  let chose: 'phone' | 'cloud' | undefined;

  if (plan.conflicts.length) {
    const months = plan.conflicts.filter(id => id !== 'core');
    const summary = [
      plan.conflicts.includes('core') ? 'subjects, timetable and settings' : '',
      months.length ? `attendance for ${months.length} ${months.length === 1 ? 'month' : 'months'}` : '',
    ].filter(Boolean).join(' and ');
    const choice = await ask(summary);
    if (!choice) return 'waiting';
    chose = choice;
    plan = resolveConflicts(plan, local, remote, choice);
  }

  await commit(c.db, uid, local, plan);
  await writeMeta(uid, { base: plan.newBase, lastSyncedAt: new Date().toISOString() });
  const pulled = plan.take.length + plan.dropLocal.length;
  return {
    pushed: plan.push.length + plan.deleteRemote.length,
    pulled, chose,
    apply: pulled ? (cur: AppData) => applyRemote(cur, remote, plan.take, plan.dropLocal, { syncLocations }) : undefined,
  };
}

/** Remove everything this account stored in the cloud (before deleting the account). */
export async function deleteCloudData(uid: string): Promise<void> {
  const c = cloud();
  if (!c) return;
  const months = await getDocs(monthsCol(c.db, uid));
  const refs = [coreRef(c.db, uid), ...months.docs.map(m => m.ref)];
  for (let i = 0; i < refs.length; i += 400) {
    const b = writeBatch(c.db);
    refs.slice(i, i + 400).forEach(r => b.delete(r));
    await b.commit();
  }
  await AsyncStorage.removeItem(META_KEY(uid));
}
