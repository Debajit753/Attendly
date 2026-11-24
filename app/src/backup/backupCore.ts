import { AppData } from '../logic';

/* Pure helpers for backups (unit tested). One file per day, newest 7 kept.
   The same file format is used by "Create backup", the automatic backups and the
   backup folder, so any of them can be restored the same way. */

export const BACKUP_PREFIX = 'attendly-auto-';
export const KEEP_DAYS = 7;

export const backupFileName = (isoDay: string) => `${BACKUP_PREFIX}${isoDay}.json`;

/** The day a backup file belongs to, from its name (tolerates Android's "name (1).json"). */
export function dayFromName(name: string): string | null {
  const m = /attendly-auto-(\d{4}-\d{2}-\d{2})/.exec(name);
  return m ? m[1] : null;
}

/** Which of these backup files to delete: anything beyond the newest KEEP_DAYS days,
    plus duplicates of a day already kept. Files that aren't backups are never touched. */
export function filesToPrune(names: string[], keep = KEEP_DAYS): string[] {
  const dated = names.map(n => ({ n, d: dayFromName(n) })).filter((x): x is { n: string; d: string } => !!x.d);
  dated.sort((a, b) => b.d.localeCompare(a.d) || a.n.length - b.n.length);   // newest first; plain name before "(1)"
  const seen = new Set<string>(), drop: string[] = [];
  for (const { n, d } of dated) {
    if (seen.has(d) || seen.size >= keep) drop.push(n);
    else seen.add(d);
  }
  return drop;
}

/** Nothing worth backing up (fresh install or after Erase): skip, so older good backups survive. */
export const isEmptyData = (d: AppData) => d.subjects.length === 0 && d.slots.length === 0 && d.records.length === 0;

/** The backup file contents (v3 format with terms; restore also reads older files). */
export function backupJson(d: AppData, now = new Date()): string {
  return JSON.stringify({
    app: 'attendly', schemaVersion: 3, exportedAt: now.toISOString(),
    data: { subjects: d.subjects, slots: d.slots, records: d.records, settings: d.settings, terms: d.terms, activeTermId: d.activeTermId },
  }, null, 2);
}
