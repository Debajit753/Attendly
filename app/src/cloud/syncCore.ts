import { AppData, Rec, Settings, Slot, Subject, Term } from '../logic';
import { validateAppData } from './validate';

/* Pure sync logic (no Firebase): split data into cloud documents, fingerprint them, and
   decide per document what to do. Kept separate so every decision is unit-tested.

   Documents: 'core' (subjects, slots, settings) and one per month 'YYYY-MM' (records).
   For each document we compare three fingerprints:
     local  = this phone now, remote = cloud now, base = both sides at the last sync.
   Only one side moved -> that side wins. Both moved differently -> conflict (ask). */

// The term list syncs; which term a device is VIEWING (activeTermId) stays on that device.
// `terms` is missing in cloud copies written before terms existed (kept missing, so their
// fingerprint still matches the last sync and the upgrade isn't mistaken for a cloud change).
export type CoreDoc = { subjects: Subject[]; slots: Slot[]; settings: Settings; terms?: Term[]; schemaVersion: number };
export type MonthDoc = { records: Rec[] };
export type Docs = Record<string, CoreDoc | MonthDoc>;   // 'core' | 'YYYY-MM'
export type Hashes = Record<string, string>;
export const SCHEMA_VERSION = 3;

/** JSON with sorted keys and no undefined values, so equal data always looks equal. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(x => (x === undefined ? 'null' : stableStringify(x))).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
}

/** 64-bit FNV-1a style fingerprint (two 32-bit lanes). For change detection, not security. */
export function fingerprint(v: unknown): string {
  const s = stableStringify(v);
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x01000197) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/** Drop undefined fields (Firestore rejects them) via a JSON round trip. */
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function splitDocs(data: AppData, opts: { syncLocations: boolean }): Docs {
  const slots = opts.syncLocations ? data.slots : data.slots.map(s => ({ ...s, lat: null, lng: null }));
  const { termStart: _s, termEnd: _e, ...settings } = data.settings;   // derived per view, never stored
  const docs: Docs = { core: plain({ subjects: data.subjects, slots, settings, terms: data.terms, schemaVersion: SCHEMA_VERSION }) };
  const byMonth: Record<string, Rec[]> = {};
  for (const r of data.records) (byMonth[r.date.slice(0, 7)] = byMonth[r.date.slice(0, 7)] || []).push(r);
  for (const ym of Object.keys(byMonth)) docs[ym] = plain({ records: [...byMonth[ym]].sort((a, b) => a.id.localeCompare(b.id)) });
  return docs;
}

export const hashDocs = (docs: Docs): Hashes => Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, fingerprint(v)]));

const isEmptyDocs = (docs: Docs) => {
  const core = docs.core as CoreDoc | undefined;
  return (!core || (core.subjects.length === 0 && core.slots.length === 0)) && Object.keys(docs).every(k => k === 'core' || (docs[k] as MonthDoc).records.length === 0);
};

export type Plan = {
  push: string[];          // upload local version
  deleteRemote: string[];  // local removed it: remove from cloud
  take: string[];          // download cloud version
  dropLocal: string[];     // cloud removed it: remove locally
  conflicts: string[];     // both changed differently: ask the user
  newBase: Hashes;         // fingerprints to remember once the plan is carried out
};

export function planSync(local: Docs, remote: Docs, base: Hashes | undefined): Plan {
  const lh = hashDocs(local), rh = hashDocs(remote), b = base ?? {};
  const plan: Plan = { push: [], deleteRemote: [], take: [], dropLocal: [], conflicts: [], newBase: { ...b } };
  const firstSync = base === undefined;
  const localEmpty = isEmptyDocs(local), remoteEmpty = isEmptyDocs(remote);

  // A brand-new phone with nothing on it simply downloads the cloud copy.
  if (firstSync && localEmpty && !remoteEmpty) {
    for (const id of Object.keys(remote)) plan.take.push(id);
    for (const id of Object.keys(local)) if (!(id in remote)) plan.dropLocal.push(id);
    plan.newBase = { ...rh };
    return plan;
  }

  for (const id of new Set([...Object.keys(lh), ...Object.keys(rh)])) {
    const l = lh[id], r = rh[id], was = b[id];
    if (l === r) { if (l === undefined) delete plan.newBase[id]; else plan.newBase[id] = l; continue; }
    const localMoved = l !== was, remoteMoved = r !== was;
    if (localMoved && !remoteMoved) (l === undefined ? plan.deleteRemote : plan.push).push(id);
    else if (remoteMoved && !localMoved) (r === undefined ? plan.dropLocal : plan.take).push(id);
    else plan.conflicts.push(id);
  }

  // Safety: never let an empty phone wipe a cloud copy that has data. Ask instead.
  if (localEmpty && !remoteEmpty) {
    plan.conflicts.push(...plan.push, ...plan.deleteRemote);
    plan.push = []; plan.deleteRemote = [];
  }
  for (const id of plan.push) plan.newBase[id] = lh[id];
  for (const id of plan.take) plan.newBase[id] = rh[id];
  for (const id of [...plan.deleteRemote, ...plan.dropLocal]) delete plan.newBase[id];
  return plan;
}

/** Settle every conflict one way: keep this phone's version, or the cloud's. */
export function resolveConflicts(plan: Plan, local: Docs, remote: Docs, choice: 'phone' | 'cloud'): Plan {
  const p: Plan = { ...plan, push: [...plan.push], deleteRemote: [...plan.deleteRemote], take: [...plan.take], dropLocal: [...plan.dropLocal], conflicts: [], newBase: { ...plan.newBase } };
  for (const id of plan.conflicts) {
    if (choice === 'phone') {
      if (id in local) { p.push.push(id); p.newBase[id] = fingerprint(local[id]); } else { p.deleteRemote.push(id); delete p.newBase[id]; }
    } else {
      if (id in remote) { p.take.push(id); p.newBase[id] = fingerprint(remote[id]); } else { p.dropLocal.push(id); delete p.newBase[id]; }
    }
  }
  return p;
}

/** Merge downloaded documents into the CURRENT local data (which may have moved on during
    the network round trip). Cloud content is untrusted: the result goes through the same
    validator as everything else. */
export function applyRemote(current: AppData, remote: Docs, take: string[], dropLocal: string[], opts: { syncLocations: boolean }): AppData {
  let subjects = current.subjects, slots = current.slots, settings = current.settings, terms = current.terms;
  if (take.includes('core')) {
    const core = remote.core as CoreDoc;
    subjects = core.subjects; settings = core.settings; terms = core.terms ?? [];   // [] -> validator migrates
    slots = opts.syncLocations ? core.slots : core.slots.map(s => {
      const mine = current.slots.find(x => x.id === s.id);   // locations stay on this phone
      return mine ? { ...s, lat: mine.lat, lng: mine.lng } : s;
    });
  }
  const replaced = new Set([...take, ...dropLocal].filter(id => id !== 'core'));
  const records = [
    ...current.records.filter(r => !replaced.has(r.date.slice(0, 7))),
    ...take.filter(id => id !== 'core').flatMap(id => (remote[id] as MonthDoc).records),
  ];
  // Keep viewing the same term if it still exists (the validator falls back otherwise).
  const checked = validateAppData({ subjects, slots, records, settings, terms, activeTermId: current.activeTermId });
  if (!checked.ok) throw new Error('The cloud copy is not valid: ' + checked.error);
  return checked.data;
}

/** Turn a raw Firestore document into a Docs entry (dropping sync stamps), or null if malformed. */
export function readRemoteDoc(id: string, raw: Record<string, unknown>): CoreDoc | MonthDoc | null {
  if (id === 'core') {
    if (!Array.isArray(raw.subjects) || !Array.isArray(raw.slots) || typeof raw.settings !== 'object' || raw.settings === null) return null;
    // Keep the document as it is in the cloud: older copies have no `terms` (the validator
    // migrates them if they're ever downloaded). Adding an empty list here would change the
    // fingerprint and look like a cloud edit, raising a false conflict.
    return plain({ subjects: raw.subjects, slots: raw.slots, settings: raw.settings, ...(Array.isArray(raw.terms) ? { terms: raw.terms } : {}), schemaVersion: Number(raw.schemaVersion) || SCHEMA_VERSION }) as CoreDoc;
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(id) || !Array.isArray(raw.records)) return null;
  return plain({ records: [...raw.records].sort((a: any, b: any) => String(a?.id).localeCompare(String(b?.id))) }) as MonthDoc;
}
