import { AppData, DEFAULT_SETTINGS, Rec, Settings, Slot, Status, Subject, Term, TODAY, addDays, isoDate, parseISO } from '../logic';

/* One schema check for every way data enters the app: the saved copy on this phone,
   a restored backup file, and (later) the cloud. It returns a CLEAN copy built field by
   field from known keys only, so unknown fields, wrong types or script-like strings in
   number fields never reach the rest of the app (or the map WebView). Individual bad
   entries are dropped and counted; a broken overall shape is rejected. */

export const LIMITS = { subjects: 100, slots: 300, records: 50000, terms: 50, idLen: 64, nameLen: 80, roomLen: 80, termNameLen: 40 };

export type Checked = { ok: true; data: AppData; dropped: number } | { ok: false; error: string };

const STATUSES: ReadonlySet<string> = new Set(['present', 'late', 'absent', 'cancelled', 'holiday', 'pending']);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);
const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
export const isISODate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && isoDate(parseISO(v)) === v;

function cleanSubject(v: unknown): Subject | null {
  if (!isObj(v)) return null;
  const id = str(v.id, LIMITS.idLen), name = typeof v.name === 'string' ? v.name.trim().slice(0, LIMITS.nameLen) : '';
  if (!id || !name) return null;
  // termId is checked against the term list later (missing or unknown -> assigned a term)
  const s: Subject = { id, name, color: typeof v.color === 'string' && HEX.test(v.color) ? v.color : '#16A34A', active: bool(v.active, true), termId: str(v.termId, LIMITS.idLen) ?? '' };
  const t = num(v.target, 1, 100);
  if (t != null) s.target = Math.round(t);
  return s;
}

function cleanTerm(v: unknown): Term | null {
  if (!isObj(v)) return null;
  const id = str(v.id, LIMITS.idLen), name = typeof v.name === 'string' ? v.name.trim().slice(0, LIMITS.termNameLen) : '';
  if (!id || !name || !isISODate(v.start) || !isISODate(v.end) || v.end < v.start) return null;
  return { id, name, start: v.start, end: v.end };
}

function cleanSlot(v: unknown, subjectIds: Set<string>): Slot | null {
  if (!isObj(v)) return null;
  const id = str(v.id, LIMITS.idLen), subjectId = str(v.subjectId, LIMITS.idLen);
  const day = num(v.day, 0, 6);
  if (!id || !subjectId || !subjectIds.has(subjectId) || day == null || !Number.isInteger(day)) return null;
  if (typeof v.start !== 'string' || !HHMM.test(v.start) || typeof v.end !== 'string' || !HHMM.test(v.end)) return null;
  // Coordinates must be real numbers in range, or both null. Anything else (e.g. a string
  // smuggling script into the map page) drops the location, not the class.
  const lat = num(v.lat, -90, 90), lng = num(v.lng, -180, 180);
  const hasLoc = lat != null && lng != null;
  return {
    id, subjectId, day, start: v.start, end: v.end,
    room: typeof v.room === 'string' ? v.room.slice(0, LIMITS.roomLen) : '',
    lat: hasLoc ? lat : null, lng: hasLoc ? lng : null,
    radius: num(v.radius, 10, 5000) ?? 100,
    active: bool(v.active, true),
  };
}

function cleanRecord(v: unknown): Rec | null {
  if (!isObj(v)) return null;
  const id = str(v.id, LIMITS.idLen), slotId = str(v.slotId, LIMITS.idLen + 8), subjectId = str(v.subjectId, LIMITS.idLen);
  if (!id || !slotId || !subjectId || !isISODate(v.date)) return null;
  if (typeof v.scheduledStart !== 'string' || !HHMM.test(v.scheduledStart)) return null;
  if (typeof v.status !== 'string' || !STATUSES.has(v.status)) return null;
  const r: Rec = { id, slotId, subjectId, date: v.date, scheduledStart: v.scheduledStart, status: v.status as Status };
  const source = str(v.source, 20);
  if (source) r.source = source;
  const planned = str(v.plannedSubjectId, LIMITS.idLen);
  if (planned) r.plannedSubjectId = planned;
  return r;
}

function cleanSettings(v: unknown): Settings {
  const s = isObj(v) ? v : {};
  const out: Settings = { ...DEFAULT_SETTINGS };
  out.target = num(s.target, 1, 100) ?? DEFAULT_SETTINGS.target;
  out.countCancelled = bool(s.countCancelled, DEFAULT_SETTINGS.countCancelled);
  if (s.themePref === 'system' || s.themePref === 'light' || s.themePref === 'dark') out.themePref = s.themePref;
  if (typeof s.remindersOn === 'boolean') out.remindersOn = s.remindersOn;
  out.reminderLead = num(s.reminderLead, 0, 120) ?? DEFAULT_SETTINGS.reminderLead;
  if (s.roundingRule === 'round' || s.roundingRule === 'floor') out.roundingRule = s.roundingRule;
  out.defaultRadius = num(s.defaultRadius, 10, 5000) ?? DEFAULT_SETTINGS.defaultRadius;
  out.graceMin = num(s.graceMin, 0, 120) ?? DEFAULT_SETTINGS.graceMin;
  return out;
}

/** Accepts the app's stored shape, or a backup file ({ app, version|schemaVersion, ... }). */
export function validateAppData(input: unknown): Checked {
  if (!isObj(input)) return { ok: false, error: "This isn't Attendly data." };
  const src = isObj(input.data) ? input.data : input;   // v2 backups nest under `data`
  if (!Array.isArray(src.subjects)) return { ok: false, error: 'No subject list found in this file.' };
  const slotsIn = Array.isArray(src.slots) ? src.slots : [];
  const recsIn = Array.isArray(src.records) ? src.records : [];
  if (src.subjects.length > LIMITS.subjects || slotsIn.length > LIMITS.slots || recsIn.length > LIMITS.records)
    return { ok: false, error: 'This file is larger than Attendly allows.' };

  let dropped = 0;
  const seen = new Set<string>();
  const unique = <T extends { id: string }>(x: T | null): x is T => {
    if (!x || seen.has(x.id)) { dropped++; return false; }
    seen.add(x.id);
    return true;
  };
  const subjects = src.subjects.map(cleanSubject).filter(unique);
  const subjectIds = new Set(subjects.map(s => s.id));
  seen.clear();
  const slots = slotsIn.map(v => cleanSlot(v, subjectIds)).filter(unique);
  seen.clear();
  const records = recsIn.map(cleanRecord).filter(unique);

  // Terms. Data from before terms existed becomes one "Term 1", built only from the data
  // itself (old term dates, else the record range), so every device migrates identically.
  seen.clear();
  let terms = (Array.isArray(src.terms) ? src.terms.slice(0, LIMITS.terms) : []).map(cleanTerm).filter(unique);
  if (terms.length === 0) {
    const old = isObj(src.settings) ? src.settings : {};
    const dates = records.map(r => r.date).sort();
    const start = isISODate(old.termStart) ? old.termStart : dates[0] ?? TODAY;
    let end = isISODate(old.termEnd) && old.termEnd >= start ? old.termEnd : addDays(start, 120);
    if (dates.length && dates[dates.length - 1] > end) end = dates[dates.length - 1];
    terms = [{ id: 'term-1', name: 'Term 1', start, end }];
  }
  const termIds = new Set(terms.map(t => t.id));
  const latest = [...terms].sort((a, b) => b.start.localeCompare(a.start))[0];
  for (const s of subjects) if (!termIds.has(s.termId)) s.termId = latest.id;
  const activeTermId = typeof src.activeTermId === 'string' && termIds.has(src.activeTermId)
    ? src.activeTermId
    : (terms.find(t => t.start <= TODAY && TODAY <= t.end) ?? latest).id;

  return { ok: true, data: { subjects, slots, records, settings: cleanSettings(src.settings), terms, activeTermId }, dropped };
}

/** Short human summary for a restore preview. */
export function describeData(d: AppData) {
  const last = d.records.reduce((m, r) => (r.date > m ? r.date : m), '');
  const terms = d.terms?.length ?? 0;
  return `${terms > 1 ? `${terms} terms, ` : ''}${d.subjects.length} subjects, ${d.slots.length} classes, ${d.records.length} records${last ? `, last record ${last}` : ''}`;
}
