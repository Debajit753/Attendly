import { describe, test, expect } from '@jest/globals';
import {
  currentPct,
  classesToReach,
  maxBunksNow,
  roundP,
  futureClassCount,
  project,
  countsFor,
  DEFAULT_SETTINGS,
  type AppData,
} from '../src/logic';

/** Minimal app data: one subject, one Monday slot, one present + one absent record. */
function makeData(overrides: Partial<AppData['settings']> = {}): AppData {
  return {
    subjects: [{ id: 's1', name: 'Physics', color: '#000', active: true }],
    slots: [{ id: 'sl1', subjectId: 's1', day: 1, start: '10:00', end: '11:00', room: '', lat: null, lng: null, radius: 100, active: true }],
    records: [
      { id: 'r1', slotId: 'sl1', subjectId: 's1', date: '2026-07-06', scheduledStart: '10:00', status: 'present' },
      { id: 'r2', slotId: 'sl1', subjectId: 's1', date: '2026-07-13', scheduledStart: '10:00', status: 'absent' },
    ],
    settings: { ...DEFAULT_SETTINGS, ...overrides },
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
