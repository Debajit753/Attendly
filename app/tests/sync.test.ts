import { describe, test, expect } from '@jest/globals';
import { AppData, DEFAULT_SETTINGS, Rec } from '../src/logic';
import { splitDocs, planSync, resolveConflicts, applyRemote, hashDocs, fingerprint, readRemoteDoc, Docs } from '../src/cloud/syncCore';

const rec = (id: string, date: string, status: Rec['status'] = 'present'): Rec => ({ id, slotId: 'sl1', subjectId: 's1', date, scheduledStart: '10:00', status });
const data = (records: Rec[] = [rec('a', '2026-11-02'), rec('b', '2026-10-05')], extra: Partial<AppData> = {}): AppData => ({
  subjects: [{ id: 's1', name: 'Physics', color: '#16A34A', active: true, termId: 't1' }],
  slots: [{ id: 'sl1', subjectId: 's1', day: 1, start: '10:00', end: '10:55', room: 'R1', lat: 22.5, lng: 88.3, radius: 100, active: true }],
  records, settings: { ...DEFAULT_SETTINGS }, terms: [{ id: 't1', name: 'Term 1', start: '2026-07-01', end: '2026-12-31' }], activeTermId: 't1', ...extra,
});
const empty = (): AppData => ({ subjects: [], slots: [], records: [], settings: { ...DEFAULT_SETTINGS }, terms: [{ id: 't1', name: 'Term 1', start: '2026-07-01', end: '2026-12-31' }], activeTermId: 't1' });
const docs = (d: AppData, syncLocations = true) => splitDocs(d, { syncLocations });

describe('splitDocs + fingerprint', () => {
  test('one core doc and one doc per month, records sorted', () => {
    const d = docs(data([rec('z', '2026-11-09'), rec('a', '2026-11-02'), rec('b', '2026-10-05')]));
    expect(Object.keys(d).sort()).toEqual(['2026-10', '2026-11', 'core']);
    expect((d['2026-11'] as any).records.map((r: Rec) => r.id)).toEqual(['a', 'z']);
  });
  test('fingerprint ignores key order and undefined fields', () => {
    expect(fingerprint({ a: 1, b: { c: 2, d: undefined } })).toBe(fingerprint({ b: { c: 2 }, a: 1 }));
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
  });
  test('no undefined values reach Firestore', () => {
    const d = data(); (d.subjects[0] as any).target = undefined;
    expect(Object.keys((docs(d).core as any).subjects[0])).not.toContain('target');
  });
  test('locations can be kept off the cloud', () => {
    const core = docs(data(), false).core as any;
    expect(core.slots[0].lat).toBeNull();
    expect(core.slots[0].lng).toBeNull();
  });
});

describe('planSync', () => {
  test('first sync with an empty cloud uploads everything', () => {
    const p = planSync(docs(data()), {}, undefined);
    expect(p.push.sort()).toEqual(['2026-10', '2026-11', 'core']);
    expect(p.conflicts).toEqual([]);
  });
  test('a new empty phone downloads the cloud copy without asking', () => {
    const cloud = docs(data());
    const p = planSync(docs(empty()), cloud, undefined);
    expect(p.take.sort()).toEqual(['2026-10', '2026-11', 'core']);
    expect(p.conflicts).toEqual([]);
    expect(p.push).toEqual([]);
  });
  test('first sync where both sides have different data asks', () => {
    const p = planSync(docs(data([rec('a', '2026-11-02')])), docs(data([rec('x', '2026-11-03')])), undefined);
    expect(p.conflicts).toContain('2026-11');
  });
  test('nothing to do when in step', () => {
    const d = docs(data());
    const p = planSync(d, d, hashDocs(d));
    expect([...p.push, ...p.take, ...p.conflicts, ...p.deleteRemote, ...p.dropLocal]).toEqual([]);
  });
  test('only the phone changed: upload just that month', () => {
    const before = docs(data());
    const after = docs(data([rec('a', '2026-11-02', 'absent'), rec('b', '2026-10-05')]));
    const p = planSync(after, before, hashDocs(before));
    expect(p.push).toEqual(['2026-11']);
    expect(p.take).toEqual([]);
  });
  test('only the cloud changed: download just that month', () => {
    const before = docs(data());
    const cloudNow = docs(data([rec('a', '2026-11-02'), rec('b', '2026-10-05', 'absent')]));
    const p = planSync(before, cloudNow, hashDocs(before));
    expect(p.take).toEqual(['2026-10']);
    expect(p.push).toEqual([]);
  });
  test('both changed the same month differently: conflict', () => {
    const before = docs(data());
    const phone = docs(data([rec('a', '2026-11-02', 'absent'), rec('b', '2026-10-05')]));
    const cloudNow = docs(data([rec('a', '2026-11-02', 'late'), rec('b', '2026-10-05')]));
    expect(planSync(phone, cloudNow, hashDocs(before)).conflicts).toEqual(['2026-11']);
  });
  test('both made the same change: no conflict', () => {
    const before = docs(data());
    const same = docs(data([rec('a', '2026-11-02', 'absent'), rec('b', '2026-10-05')]));
    const p = planSync(same, same, hashDocs(before));
    expect(p.conflicts).toEqual([]);
    expect(p.newBase['2026-11']).toBe(hashDocs(same)['2026-11']);
  });
  test('a month emptied on the phone is deleted in the cloud', () => {
    const before = docs(data());
    const p = planSync(docs(data([rec('a', '2026-11-02')])), before, hashDocs(before));
    expect(p.deleteRemote).toEqual(['2026-10']);
  });
  test('an emptied phone never wipes a cloud copy that has data: it asks', () => {
    const before = docs(data());
    const p = planSync(docs(empty()), before, hashDocs(before));
    expect(p.deleteRemote).toEqual([]);
    expect(p.push).toEqual([]);
    expect(p.conflicts.sort()).toEqual(['2026-10', '2026-11', 'core']);
  });
});

describe('resolveConflicts', () => {
  const before = docs(data());
  const phone = docs(data([rec('a', '2026-11-02', 'absent'), rec('b', '2026-10-05')]));
  const cloudNow = docs(data([rec('a', '2026-11-02', 'late'), rec('b', '2026-10-05')]));
  const plan = planSync(phone, cloudNow, hashDocs(before));
  test('keep this phone uploads', () => {
    const p = resolveConflicts(plan, phone, cloudNow, 'phone');
    expect(p.push).toContain('2026-11');
    expect(p.newBase['2026-11']).toBe(hashDocs(phone)['2026-11']);
  });
  test('keep cloud downloads', () => {
    const p = resolveConflicts(plan, phone, cloudNow, 'cloud');
    expect(p.take).toContain('2026-11');
    expect(p.newBase['2026-11']).toBe(hashDocs(cloudNow)['2026-11']);
  });
});

describe('applyRemote', () => {
  test('replaces only the downloaded months and keeps edits made meanwhile', () => {
    const cloudNow = docs(data([rec('a', '2026-11-02'), rec('b', '2026-10-05', 'absent')]));
    const current = data([rec('a', '2026-11-02', 'late'), rec('b', '2026-10-05')]);   // November edited during sync
    const out = applyRemote(current, cloudNow, ['2026-10'], [], { syncLocations: true });
    expect(out.records.find(r => r.id === 'b')!.status).toBe('absent');   // from cloud
    expect(out.records.find(r => r.id === 'a')!.status).toBe('late');     // local edit kept
  });
  test('locations stay on the phone when not synced', () => {
    const cloudCore = docs(data(), false);
    const out = applyRemote(data(), cloudCore, ['core'], [], { syncLocations: false });
    expect(out.slots[0].lat).toBe(22.5);
  });
  test('cloud content is validated (bad entries dropped)', () => {
    const bad: Docs = { '2026-11': { records: [rec('ok', '2026-11-02'), { ...rec('evil', '2026-11-03'), status: 'hacked' as any }] } };
    const out = applyRemote(empty(), bad, ['2026-11'], [], { syncLocations: true });
    expect(out.records.map(r => r.id)).toEqual(['ok']);
  });
});

describe('readRemoteDoc', () => {
  test('strips sync stamps and rejects malformed docs', () => {
    const c = readRemoteDoc('core', { subjects: [], slots: [], settings: {}, schemaVersion: 2, updatedAt: 'x', deviceId: 'd' }) as any;
    expect(c.updatedAt).toBeUndefined();
    expect(readRemoteDoc('core', { subjects: 'no' })).toBeNull();
    expect(readRemoteDoc('2026-13', { records: [] })).toBeNull();
  });
});

describe('terms in sync', () => {
  test('the term list syncs, the viewed term does not', () => {
    const core = docs(data()).core as any;
    expect(core.terms).toEqual([{ id: 't1', name: 'Term 1', start: '2026-07-01', end: '2026-12-31' }]);
    expect(core.activeTermId).toBeUndefined();
    expect(core.settings.termStart).toBeUndefined();
  });
  test('switching the viewed term changes nothing in the cloud', () => {
    const a = hashDocs(docs(data()));
    const b = hashDocs(docs({ ...data(), activeTermId: 'other' }));
    expect(b).toEqual(a);
  });
  test('downloading keeps the term this device is viewing', () => {
    const cloud = docs({ ...data(), terms: [{ id: 't1', name: 'Term 1', start: '2026-07-01', end: '2026-12-31' }, { id: 't2', name: 'Term 2', start: '2027-01-01', end: '2027-05-31' }] });
    const out = applyRemote({ ...data(), activeTermId: 't1' }, cloud, ['core'], [], { syncLocations: true });
    expect(out.terms).toHaveLength(2);
    expect(out.activeTermId).toBe('t1');
  });
});

describe('upgrading an old cloud copy to terms', () => {
  test('a cloud copy from before terms is not mistaken for a cloud change', () => {
    // The cloud still has the old core (no terms); the phone has just migrated to terms.
    const oldCore = { subjects: [{ id: 's1', name: 'Physics', color: '#16A34A', active: true }], slots: [], settings: { ...DEFAULT_SETTINGS }, schemaVersion: 2 };
    const base = { core: fingerprint(oldCore) };
    const remote: Docs = { core: readRemoteDoc('core', { ...oldCore, updatedAt: 'x', deviceId: 'd' })! };
    const local: Docs = { core: { ...oldCore, subjects: [{ ...oldCore.subjects[0], termId: 'term-1' }], terms: [{ id: 'term-1', name: 'Term 1', start: '2026-07-01', end: '2026-12-31' }], schemaVersion: 3 } as any };
    const p = planSync(local, remote, base);
    expect(p.conflicts).toEqual([]);
    expect(p.push).toEqual(['core']);
  });
});
