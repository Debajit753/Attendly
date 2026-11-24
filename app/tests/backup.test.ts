import { describe, test, expect } from '@jest/globals';
import { backupFileName, dayFromName, filesToPrune, isEmptyData, backupJson } from '../src/backup/backupCore';
import { validateAppData } from '../src/cloud/validate';
import { DEFAULT_SETTINGS, AppData } from '../src/logic';

const days = (n: number) => Array.from({ length: n }, (_, i) => backupFileName(`2026-11-${String(i + 1).padStart(2, '0')}`));

describe('backup file names', () => {
  test('one file per day', () => expect(backupFileName('2026-11-24')).toBe('attendly-auto-2026-11-24.json'));
  test('reads the day back, including Android duplicates', () => {
    expect(dayFromName('attendly-auto-2026-11-24.json')).toBe('2026-11-24');
    expect(dayFromName('attendly-auto-2026-11-24 (1).json')).toBe('2026-11-24');
    expect(dayFromName('holiday-photo.jpg')).toBeNull();
  });
});

describe('filesToPrune', () => {
  test('keeps the newest 7 days', () => {
    const drop = filesToPrune(days(10));
    expect(drop.sort()).toEqual(days(3).sort());
  });
  test('nothing to delete with 7 or fewer', () => expect(filesToPrune(days(7))).toEqual([]));
  test('drops duplicate copies of a kept day, keeping the plain name', () => {
    expect(filesToPrune(['attendly-auto-2026-11-24.json', 'attendly-auto-2026-11-24 (1).json'])).toEqual(['attendly-auto-2026-11-24 (1).json']);
  });
  test('never touches files that are not backups', () => {
    expect(filesToPrune([...days(9), 'notes.txt', 'attendly-backup-2026-01-01.json'])).not.toContain('notes.txt');
  });
});

describe('backup contents', () => {
  const data: AppData = {
    subjects: [{ id: 's1', name: 'Physics', color: '#16A34A', active: true, termId: 't1' }],
    slots: [], records: [{ id: 'r1', slotId: 'x', subjectId: 's1', date: '2026-11-23', scheduledStart: '10:00', status: 'present' }],
    settings: { ...DEFAULT_SETTINGS },
    terms: [{ id: 't1', name: 'Term 1', start: '2026-07-01', end: '2026-12-31' }], activeTermId: 't1',
  };
  test('empty data is skipped so it cannot replace good backups', () => {
    expect(isEmptyData({ subjects: [], slots: [], records: [], settings: { ...DEFAULT_SETTINGS }, terms: [{ id: 't1', name: 'Term 1', start: '2026-07-01', end: '2026-12-31' }], activeTermId: 't1' })).toBe(true);
    expect(isEmptyData(data)).toBe(false);
  });
  test('a backup file restores to the same data', () => {
    const res = validateAppData(JSON.parse(backupJson(data)));
    expect(res.ok && res.data.records[0].id).toBe('r1');
    expect(res.ok && res.data.terms).toEqual(data.terms);
  });
});
