import { describe, test, expect } from '@jest/globals';
import {
  currentPct,
  classesToReach,
  maxBunksNow,
  roundP,
  futureClassCount,
  project,
  countsFor,
  streaks,
  changeRecSubject,
  dayKind,
  ensureDayRecords,
  DEFAULT_SETTINGS,
  type AppData,
  termView,
  startTerm,
  materializeToday,
  plannedSlotsOn,
  TODAY,
  TODAY_DOW,
  addDays,
} from '../src/logic';

/** Minimal app data: one subject, one Monday slot, one present + one absent record. */
function makeData(overrides: Partial<AppData['settings']> = {}): AppData {
  return {
    subjects: [{ id: 's1', name: 'Physics', color: '#000', active: true, termId: 't1' }],
    slots: [{ id: 'sl1', subjectId: 's1', day: 1, start: '10:00', end: '11:00', room: '', lat: null, lng: null, radius: 100, active: true }],
    records: [
      { id: 'r1', slotId: 'sl1', subjectId: 's1', date: '2026-07-06', scheduledStart: '10:00', status: 'present' },
      { id: 'r2', slotId: 'sl1', subjectId: 's1', date: '2026-07-13', scheduledStart: '10:00', status: 'absent' },
    ],
    settings: { ...DEFAULT_SETTINGS, ...overrides },
    terms: [{ id: 't1', name: 'Term 1', start: '2026-07-01', end: '2026-12-31' }], activeTermId: 't1',
  };
}

describe('currentPct', () => {
  test('handles no classes held', () => expect(currentPct(0, 0)).toBe(0));
  test('computes a/h', () => expect(currentPct(40, 49)).toBeCloseTo(81.63, 1));
});

describe('classesToReach (must-attend)', () => {
  test('already at/above target → 0', () => expect(classesToReach(40, 49, 75)).toBe(0));
  test('11 in a row to reach 75%', () => expect(classesToReach(7, 13, 75)).toBe(11));
  test('at 100% needs 0', () => expect(classesToReach(10, 10, 100)).toBe(0));
  test('100% is impossible after a miss', () => expect(classesToReach(9, 10, 100)).toBeNull());
});

describe('maxBunksNow (skip budget)', () => {
  test('tiny buffer rounds down to 0', () => expect(maxBunksNow(8, 10, 75)).toBe(0));
  test('40/49 at 75% → 4', () => expect(maxBunksNow(40, 49, 75)).toBe(4));
});

describe('roundP (college rounding rule)', () => {
  test('round', () => expect(roundP(74.6, 'round')).toBe(75));
  test('truncate', () => expect(roundP(74.6, 'floor')).toBe(74));
});

describe('countsFor', () => {
  test('late counts as attended; absent only as held', () => {
    const d = makeData();
    d.records.push({ id: 'r3', slotId: 'sl1', subjectId: 's1', date: '2026-07-20', scheduledStart: '10:00', status: 'late' });
    // present + late = 2 attended, + absent = 3 held
    expect(countsFor(d, 's1')).toEqual({ a: 2, h: 3 });
  });
  test('cancelled/holiday excluded from the denominator', () => {
    const d = makeData();
    d.records.push({ id: 'r4', slotId: 'sl1', subjectId: 's1', date: '2026-07-27', scheduledStart: '10:00', status: 'cancelled' });
    d.records.push({ id: 'r5', slotId: 'sl1', subjectId: 's1', date: '2026-07-28', scheduledStart: '10:00', status: 'holiday' });
    expect(countsFor(d, 's1')).toEqual({ a: 1, h: 2 });
  });
});

describe('futureClassCount', () => {
  test('a 7-day window contains exactly one of each weekday', () => {
    const d = makeData();
    // one weekly slot → exactly one occurrence in any 7-day span
    expect(futureClassCount(d, 's1', '2026-08-03', '2026-08-10')).toBe(1);
  });
  test('term end in the past → 0', () => {
    const d = makeData();
    expect(futureClassCount(d, 's1', '2026-08-03', '2026-08-03')).toBe(0);
  });
});

describe('project (end-of-term)', () => {
  test('combines current counts with remaining classes', () => {
    const d = makeData(); // a=1, h=2 (present + absent)
    const p = project(d, 's1', '2026-08-03', '2026-08-10'); // future = 1
    expect(p.future).toBe(1);
    expect(p.finalIfAll).toBeCloseTo(66.67, 1);   // (1+1)/(2+1)
    expect(p.finalIfNone).toBeCloseTo(33.33, 1);  // 1/(2+1)
    expect(p.recoverable).toBe(false);            // can't reach 75% here
    expect(p.canSkip).toBe(0);
  });
});

describe('changeRecSubject (class swap)', () => {
  function twoSubjects(): AppData {
    const d = makeData();
    d.subjects.push({ id: 's2', name: 'BEEE', color: '#111', active: true, termId: 't1' });
    d.records.push({ id: 'r9', slotId: 'sl1', subjectId: 's1', date: '2026-07-20', scheduledStart: '10:00', status: 'pending' });
    return d;
  }
  test('timetabled subject is frozen: not held, not absent', () => {
    const before = countsFor(twoSubjects(), 's1');
    const d = changeRecSubject(twoSubjects(), 'r9', 's2');
    expect(countsFor(d, 's1')).toEqual(before);           // Maths unchanged
    const r = d.records.find(x => x.id === 'r9')!;
    expect(r.subjectId).toBe('s2');
    expect(r.plannedSubjectId).toBe('s1');
    expect(r.status).toBe('pending');
  });
  test('marking the swapped class counts only for the new subject', () => {
    let d = changeRecSubject(twoSubjects(), 'r9', 's2');
    d = { ...d, records: d.records.map(r => (r.id === 'r9' ? { ...r, status: 'present' as const } : r)) };
    expect(countsFor(d, 's2')).toEqual({ a: 1, h: 1 });
    expect(countsFor(d, 's1')).toEqual({ a: 1, h: 2 });
  });
  test('a mark made for the old subject is not carried over', () => {
    const d0 = twoSubjects();
    d0.records = d0.records.map(r => (r.id === 'r9' ? { ...r, status: 'absent' as const } : r));
    const d = changeRecSubject(d0, 'r9', 's2');
    expect(countsFor(d, 's1')).toEqual({ a: 1, h: 2 });   // the absent left with the swap
    expect(countsFor(d, 's2')).toEqual({ a: 0, h: 0 });
  });
  test('picking the timetabled subject again restores the class', () => {
    const d = changeRecSubject(changeRecSubject(twoSubjects(), 'r9', 's2'), 'r9', 's1');
    const r = d.records.find(x => x.id === 'r9')!;
    expect(r.subjectId).toBe('s1');
    expect(r.plannedSubjectId).toBeUndefined();
  });
});

describe('dayKind (calendar colour)', () => {
  const rec = (status: any) => ({ id: 'x', slotId: 'a', subjectId: 's', date: 'd', scheduledStart: '09:00', status });
  test('late counts as attended', () => expect(dayKind([rec('late')])).toBe('present'));
  test('mixed day is partial', () => expect(dayKind([rec('present'), rec('absent')])).toBe('partial'));
  test('all absent', () => expect(dayKind([rec('absent')])).toBe('absent'));
  test('holiday only is off', () => expect(dayKind([rec('holiday'), rec('cancelled')])).toBe('off'));
  test('unmarked day is pending', () => expect(dayKind([rec('pending')])).toBe('pending'));
  test('nothing scheduled', () => expect(dayKind([])).toBe('none'));
});

describe('ensureDayRecords (open a date)', () => {
  test('creates pending classes for a past timetabled day once', () => {
    const d = makeData();                                    // Monday slot, no record on 2026-07-27 (a Monday)
    const once = ensureDayRecords(d, '2026-07-27', '2026-08-01');
    expect(once.records.filter(r => r.date === '2026-07-27')).toHaveLength(1);
    const twice = ensureDayRecords(once, '2026-07-27', '2026-08-01');
    expect(twice.records).toHaveLength(once.records.length);
  });
  test('never creates records for future dates', () => {
    const d = makeData();
    expect(ensureDayRecords(d, '2026-08-10', '2026-08-01').records).toHaveLength(d.records.length);
  });
});

describe('streaks (continuous, class by class)', () => {
  const at = (id: string, date: string, start: string, status: any) => ({ id, slotId: 'sl1', subjectId: 's1', date, scheduledStart: start, status });
  const withRecs = (recs: any[]) => ({ ...makeData(), records: recs });
  const TODAY_ = '2026-11-24';
  test('counts classes, not days', () => {
    const s = streaks(withRecs([at('a', '2026-11-23', '09:00', 'present'), at('b', '2026-11-23', '11:00', 'late')]), TODAY_);
    expect(s.current).toBe(2);
  });
  test('an absence breaks the run; best is remembered', () => {
    const s = streaks(withRecs([
      at('a', '2026-11-20', '09:00', 'present'), at('b', '2026-11-20', '11:00', 'present'), at('c', '2026-11-20', '12:00', 'present'),
      at('d', '2026-11-21', '09:00', 'absent'), at('e', '2026-11-23', '09:00', 'present'),
    ]), TODAY_);
    expect(s.current).toBe(1);
    expect(s.best).toBe(3);
  });
  test('not held and holidays are skipped, not breaks', () => {
    const s = streaks(withRecs([at('a', '2026-11-20', '09:00', 'present'), at('b', '2026-11-21', '09:00', 'cancelled'), at('c', '2026-11-22', '09:00', 'holiday'), at('d', '2026-11-23', '09:00', 'present')]), TODAY_);
    expect(s.current).toBe(2);
  });
  test('an unmarked past class pauses the streak and remembers where it was', () => {
    const s = streaks(withRecs([at('a', '2026-11-20', '09:00', 'present'), at('b', '2026-11-21', '09:00', 'present'), at('c', '2026-11-23', '09:00', 'pending')]), TODAY_);
    expect(s.current).toBe(0);
    expect(s.paused).toBe(1);
    expect(s.pausedAt).toBe(2);
  });
  test("today's unmarked classes don't count against you", () => {
    const s = streaks(withRecs([at('a', '2026-11-23', '09:00', 'present'), at('b', TODAY_, '09:00', 'pending')]), TODAY_);
    expect(s.current).toBe(1);
    expect(s.paused).toBe(0);
  });
});

describe('terms keep semesters separate', () => {
  /** Two terms: Sem 1 (past) and Sem 2 (running today), each with its own Physics. */
  function twoTerms(): AppData {
    const sem2Start = addDays(TODAY, -10), sem1End = addDays(TODAY, -11);
    return {
      subjects: [
        { id: 'p1', name: 'Physics', color: '#000', active: true, termId: 'sem1' },
        { id: 'p2', name: 'Physics', color: '#000', active: true, termId: 'sem2' },
      ],
      slots: [
        { id: 'a', subjectId: 'p1', day: TODAY_DOW, start: '09:00', end: '10:00', room: '', lat: null, lng: null, radius: 100, active: true },
        { id: 'b', subjectId: 'p2', day: TODAY_DOW, start: '09:00', end: '10:00', room: '', lat: null, lng: null, radius: 100, active: true },
      ],
      records: [
        { id: 'r1', slotId: 'a', subjectId: 'p1', date: addDays(sem1End, -7), scheduledStart: '09:00', status: 'absent' },
        { id: 'r2', slotId: 'b', subjectId: 'p2', date: addDays(TODAY, -7), scheduledStart: '09:00', status: 'present' },
      ],
      settings: { ...DEFAULT_SETTINGS },
      terms: [
        { id: 'sem1', name: 'Sem 1', start: addDays(sem1End, -120), end: sem1End },
        { id: 'sem2', name: 'Sem 2', start: sem2Start, end: addDays(sem2Start, 120) },
      ],
      activeTermId: 'sem2',
    };
  }
  test("each term only sees its own subjects and attendance", () => {
    const d = twoTerms();
    expect(countsFor(termView(d), 'p2')).toEqual({ a: 1, h: 1 });
    expect(termView(d).subjects.map(s => s.id)).toEqual(['p2']);
    expect(termView(d, 'sem1').records.map(r => r.id)).toEqual(['r1']);
  });
  test('the viewed term supplies the term dates', () => {
    const v = termView(twoTerms(), 'sem1');
    expect(v.settings.termEnd).toBe(addDays(TODAY, -11));
  });
  test("today's classes are only created for the term running today", () => {
    const out = materializeToday(twoTerms());
    const todays = out.records.filter(r => r.date === TODAY);
    expect(todays.map(r => r.slotId)).toEqual(['b']);
  });
  test('nothing is scheduled between terms', () => {
    const d = twoTerms();
    d.terms = [d.terms[0]];
    expect(materializeToday(d).records).toHaveLength(2);
  });
  test('a date only shows the timetable of the term it belongs to', () => {
    const d = twoTerms();
    expect(plannedSlotsOn(d, TODAY).map(s => s.id)).toEqual(['b']);
    expect(plannedSlotsOn(d, addDays(TODAY, -42)).map(s => s.id)).toEqual(['a']);   // same weekday, inside Sem 1
  });
  test('the streak resets each term', () => {
    expect(streaks(termView(twoTerms(), 'sem2'), TODAY).current).toBe(1);
    expect(streaks(termView(twoTerms(), 'sem1'), TODAY).current).toBe(0);
  });
  test('starting a term can copy the timetable, never the attendance', () => {
    const d = { ...twoTerms(), activeTermId: 'sem2' };
    const start = addDays(TODAY, 200);
    const out = startTerm(d, { name: 'Sem 3', start, end: addDays(start, 100) }, 'sem2');
    const sem3 = out.terms.find(t => t.name === 'Sem 3')!;
    expect(out.activeTermId).toBe(sem3.id);
    const subs = out.subjects.filter(s => s.termId === sem3.id);
    expect(subs.map(s => s.name)).toEqual(['Physics']);
    expect(subs[0].id).not.toBe('p2');
    expect(out.slots.filter(s => s.subjectId === subs[0].id)).toHaveLength(1);
    expect(termView(out).records).toHaveLength(0);
  });
  test('starting a term without copying begins empty', () => {
    const out = startTerm(twoTerms(), { name: 'Sem 3', start: addDays(TODAY, 200), end: addDays(TODAY, 300) });
    expect(termView(out).subjects).toHaveLength(0);
  });
});
