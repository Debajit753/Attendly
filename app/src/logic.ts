import { SUBJECT_COLORS } from './theme';

export type Status = 'present' | 'late' | 'absent' | 'cancelled' | 'holiday' | 'pending';
export type Zone = 'safe' | 'warn' | 'danger' | 'building' | 'neutral';

// termId: every subject belongs to one term (semester); its slots and records follow it.
export interface Subject { id: string; name: string; color: string; active: boolean; target?: number; termId: string; }  // target: optional per-subject %
/** A semester. Attendance, subjects, timetable and streak are kept separate per term. */
export interface Term { id: string; name: string; start: string; end: string; }   // ISO yyyy-mm-dd, inclusive
export interface Slot { id: string; subjectId: string; day: number; start: string; end: string; room: string; lat: number | null; lng: number | null; radius: number; active: boolean; }
// plannedSubjectId: set when this one class was swapped to another subject. The planned
// subject is frozen for that date (not held, not absent); `subjectId` is what actually ran.
export interface Rec { id: string; slotId: string; subjectId: string; date: string; scheduledStart: string; status: Status; source?: string; plannedSubjectId?: string; }
export type ThemePref = 'system' | 'light' | 'dark';
export type RoundingRule = 'round' | 'floor';
export interface Settings {
  target: number;
  countCancelled: boolean;
  themePref: ThemePref;
  termStart?: string;         // derived by termView() from the viewed term; not stored
  termEnd?: string;           // derived by termView() from the viewed term; not stored
  remindersOn?: boolean;      // class-time reminders (dev build only)
  reminderLead?: number;      // minutes before class to remind (default 10)
  roundingRule?: RoundingRule; // how the % is shown (some colleges truncate 74.6 → 74)
  defaultRadius?: number;     // default check-in radius, metres (default 100)
  graceMin?: number;          // minutes after start still "on time"; later = Late (default 15)
}
export interface AppData {
  subjects: Subject[]; slots: Slot[]; records: Rec[]; settings: Settings;
  terms: Term[];
  activeTermId: string;       // the term being viewed (this device only; not synced)
}

export const DEFAULT_SETTINGS: Settings = { target: 75, countCancelled: false, themePref: 'light', reminderLead: 10, roundingRule: 'round', defaultRadius: 100, graceMin: 15 };

/** Round a % for display per the college rule (round or truncate). */
export const roundP = (p: number, rule?: RoundingRule) => (rule === 'floor' ? Math.floor(p + 1e-9) : Math.round(p));
/** The target that applies to a subject (its own, else the global default). */
export const subjectTarget = (data: AppData, s: Subject) => s.target ?? data.settings.target;

let counter = 0;
export const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

/* ---- terms ---- */
export const termById = (data: AppData, id: string) => data.terms.find(t => t.id === id);
/** The term containing this date (if any). */
export const termForDate = (data: AppData, iso: string) => data.terms.find(t => t.start <= iso && iso <= t.end);
/** The term running today, if any. New classes are only ever created for this term. */
export const currentTerm = (data: AppData, today: string = TODAY) => termForDate(data, today);
/** The most recent term by start date. */
export const latestTerm = (data: AppData) => [...data.terms].sort((a, b) => b.start.localeCompare(a.start))[0];
export const termSubjectIds = (data: AppData, termId: string) => new Set(data.subjects.filter(s => s.termId === termId).map(s => s.id));

/** What every screen reads: only the viewed term's subjects, slots and records, with the
    term's dates exposed as settings.termStart/termEnd. Writes still go to the full data
    (ids are unique), so screens can keep calling setData on the whole thing. */
export function termView(data: AppData, termId: string = data.activeTermId): AppData {
  const t = termById(data, termId) ?? latestTerm(data);
  if (!t) return data;
  const ids = termSubjectIds(data, t.id);
  return {
    ...data,
    activeTermId: t.id,
    subjects: data.subjects.filter(s => ids.has(s.id)),
    slots: data.slots.filter(s => ids.has(s.subjectId)),
    records: data.records.filter(r => ids.has(r.subjectId)),
    settings: { ...data.settings, termStart: t.start, termEnd: t.end },
  };
}

/** A fresh, empty app with one term starting today. */
export function emptyData(settings: Settings = { ...DEFAULT_SETTINGS }): AppData {
  const term: Term = { id: 'term-' + uid(), name: 'Term 1', start: TODAY, end: addDays(TODAY, 120) };
  return { subjects: [], slots: [], records: [], settings: { ...settings, termStart: undefined, termEnd: undefined }, terms: [term], activeTermId: term.id };
}

export function updateTerm(data: AppData, id: string, patch: Partial<Omit<Term, 'id'>>): AppData {
  return { ...data, terms: data.terms.map(t => (t.id === id ? { ...t, ...patch } : t)) };
}

/** Start a new term (and switch to it). Optionally copy another term's subjects and
    timetable as a starting point: new ids, same names, colours, targets, rooms and locations.
    Attendance is never copied. */
export function startTerm(data: AppData, t: { name: string; start: string; end: string }, copyFrom?: string): AppData {
  const term: Term = { id: 'term-' + uid(), name: t.name.trim() || 'New term', start: t.start, end: t.end };
  let subjects = data.subjects, slots = data.slots;
  if (copyFrom) {
    const map = new Map<string, string>();
    const src = data.subjects.filter(s => s.termId === copyFrom);
    const newSubs = src.map(s => { const id = uid(); map.set(s.id, id); return { ...s, id, termId: term.id }; });
    const newSlots = data.slots.filter(sl => map.has(sl.subjectId)).map(sl => ({ ...sl, id: uid(), subjectId: map.get(sl.subjectId)! }));
    subjects = [...subjects, ...newSubs];
    slots = [...slots, ...newSlots];
  }
  return materializeToday({ ...data, terms: [...data.terms, term], subjects, slots, activeTermId: term.id });
}

/* ---- dates ---- */
const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Live bindings: refreshToday() moves them forward after midnight, and every importer
// reads the new value (ES modules re-export `let` bindings live).
export let TODAY = isoDate(new Date());
export let TODAY_DOW = new Date().getDay();
/** Re-read the clock. Returns true if the date changed (the app then re-renders). */
export function refreshToday(now: Date = new Date()): boolean {
  const t = isoDate(now);
  if (t === TODAY) return false;
  TODAY = t;
  TODAY_DOW = now.getDay();
  return true;
}
export const parseISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso: string, n: number) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoDate(d); };
export const niceToday = () => parseISO(TODAY).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

/* ---- bunk math (PRD §9) ---- */
export const currentPct = (a: number, h: number) => (h <= 0 ? 0 : (a / h) * 100);
export function classesToReach(a: number, h: number, T: number): number | null {
  if (h > 0 && currentPct(a, h) >= T) return 0;
  if (T >= 100) return null;
  let n = 0;
  while ((a + n) / (h + n) * 100 < T) { n++; if (n > 1e6) return null; }
  return n;
}
export const maxBunksNow = (a: number, h: number, T: number) =>
  T <= 0 ? Infinity : h <= 0 ? 0 : Math.max(0, Math.floor(a / (T / 100) - h + 1e-9));

/* Great-circle distance in metres between two lat/lng points. */
export function haversine(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371000, dLa = ((la2 - la1) * Math.PI) / 180, dLo = ((lo2 - lo1) * Math.PI) / 180;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/* ---- computed ---- */
export function countsFor(data: AppData, subjectId: string | null): { a: number; h: number } {
  const from = data.settings.termStart;   // count only within the current term, if set
  const to = data.settings.termEnd;        // (ISO strings compare correctly lexicographically)
  let a = 0, h = 0;
  for (const r of data.records) {
    if (subjectId && r.subjectId !== subjectId) continue;
    if (from && r.date < from) continue;   // before this semester started — ignore
    if (to && r.date > to) continue;       // after this semester ended — ignore
    if (r.status === 'present' || r.status === 'late') { a++; h++; }  // late still counts as attended
    else if (r.status === 'absent') h++;
    else if (r.status === 'cancelled' && data.settings.countCancelled) h++;
  }
  return { a, h };
}
export function overallCounts(data: AppData) {
  let a = 0, h = 0;
  for (const s of data.subjects) { if (!s.active) continue; const c = countsFor(data, s.id); a += c.a; h += c.h; }
  return { a, h };
}
export function statusOf(a: number, h: number, target: number): Zone {
  if (h < 6) return 'building';
  const p = currentPct(a, h);
  if (p < target) return 'danger';
  if (p < target + 3) return 'warn';
  return 'safe';
}
export function subjectStats(data: AppData) {
  return data.subjects.filter(s => s.active).map(s => {
    const c = countsFor(data, s.id);
    const T = subjectTarget(data, s);
    return { s, ...c, pct: currentPct(c.a, c.h), target: T, zone: statusOf(c.a, c.h, T) };
  }).sort((x, y) => x.pct - y.pct);
}
/** The subject with the least room to skip (the one holding you back). */
export function limitingSubject(data: AppData) {
  const meaningful = subjectStats(data).filter(x => x.h >= 6);
  if (meaningful.length === 0) return null;
  let tight = meaningful[0], budget = maxBunksNow(meaningful[0].a, meaningful[0].h, meaningful[0].target);
  for (const x of meaningful) {
    const b = maxBunksNow(x.a, x.h, x.target);
    if (b < budget) { budget = b; tight = x; }
  }
  return { ...tight, budget };
}
type StreakMark = 'attended' | 'missed' | 'unmarked';
export interface Streak {
  current: number;          // classes attended in a row, ending at the most recent class
  best: number;             // longest run ever
  paused: number;           // > 0: the run is interrupted by this many unmarked past classes
  pausedAt: number;         // the run length just before those unmarked classes
}
/** Continuous class streak, one class at a time in timetable order.
    Present/late extends it, absent breaks it, not held / holiday are skipped (not your fault),
    an unmarked PAST class pauses it until marked, and today's unmarked classes don't count yet. */
export function streaks(data: AppData, todayISO: string = TODAY): Streak {
  const seq: StreakMark[] = data.records
    .filter(r => r.status === 'present' || r.status === 'late' || r.status === 'absent' || (r.status === 'pending' && r.date < todayISO))
    .sort((a, b) => a.date.localeCompare(b.date) || a.scheduledStart.localeCompare(b.scheduledStart))
    .map(r => (r.status === 'pending' ? 'unmarked' : r.status === 'absent' ? 'missed' : 'attended'));
  let best = 0, run = 0;
  for (const m of seq) { if (m === 'attended') { run++; best = Math.max(best, run); } else run = 0; }
  // Unmarked classes at the end of the sequence pause the streak instead of hiding the gap.
  let paused = 0, pausedAt = 0;
  for (let i = seq.length - 1; i >= 0 && seq[i] === 'unmarked'; i--) paused++;
  for (let i = seq.length - 1 - paused; paused && i >= 0 && seq[i] === 'attended'; i--) pausedAt++;
  return { current: run, best, paused, pausedAt };
}

/* ---- end-of-term projection ----
   Looks at the weekly timetable and counts how many class instances remain
   between tomorrow and the term-end date, then projects where you'll land. */
export interface Projection {
  a: number; h: number;        // attended / held so far
  future: number;              // class instances left until term end
  finalIfAll: number;          // final % if you attend every remaining class
  finalIfNone: number;         // final % if you skip every remaining class
  canSkip: number;             // of the remaining, how many you can still miss & finish >= target
  mustAttend: number;          // of the remaining, how many you must attend to finish >= target
  recoverable: boolean;        // is finishing >= target still possible at all
  alreadySafe: boolean;        // do you finish >= target even skipping everything left
}

/** Count remaining class instances (tomorrow … termEnd inclusive) from the weekly slots. */
export function futureClassCount(data: AppData, subjectId: string | null, todayISO: string, termEndISO: string): number {
  const activeIds = new Set(data.subjects.filter(s => s.active).map(s => s.id));
  const slots = data.slots.filter(s => s.active && activeIds.has(s.subjectId) && (subjectId ? s.subjectId === subjectId : true));
  if (slots.length === 0) return 0;
  const from = parseISO(todayISO), to = parseISO(termEndISO);
  if (to <= from) return 0;
  const byDow: Record<number, number> = {};
  for (const s of slots) byDow[s.day] = (byDow[s.day] || 0) + 1;
  let count = 0;
  const d = new Date(from);
  d.setDate(d.getDate() + 1);                 // start tomorrow — today's classes are handled live
  while (d <= to) { count += byDow[d.getDay()] || 0; d.setDate(d.getDate() + 1); }
  return count;
}

export function project(data: AppData, subjectId: string | null, todayISO: string, termEndISO: string, target?: number): Projection {
  const { a, h } = subjectId ? countsFor(data, subjectId) : overallCounts(data);
  const T = target ?? data.settings.target;
  const future = futureClassCount(data, subjectId, todayISO, termEndISO);
  const H = h + future;
  const finalIfAll = H <= 0 ? currentPct(a, h) : ((a + future) / H) * 100;
  const finalIfNone = H <= 0 ? currentPct(a, h) : (a / H) * 100;
  const recoverable = finalIfAll >= T - 1e-9;
  const alreadySafe = finalIfNone >= T - 1e-9;
  // Attend (future - x) of the remaining, skip x: need (a + future - x)/(h + future) >= T/100
  let canSkip = Math.floor(future - ((T / 100) * H - a) + 1e-9);
  canSkip = Math.max(0, Math.min(future, canSkip));
  const mustAttend = Math.max(0, future - canSkip);
  return { a, h, future, finalIfAll, finalIfNone, canSkip, mustAttend, recoverable, alreadySafe };
}

/* ---- materialize today's classes ---- */
export function materializeToday(data: AppData): AppData {
  const term = currentTerm(data);
  if (!term) return data;                       // between terms: nothing is scheduled
  const recs = [...data.records];
  const activeSub = new Set(data.subjects.filter(s => s.active && s.termId === term.id).map(s => s.id));
  for (const sl of data.slots.filter(s => s.active && s.day === TODAY_DOW && activeSub.has(s.subjectId))) {
    if (!recs.find(r => r.slotId === sl.id && r.date === TODAY)) {
      recs.push({ id: uid(), slotId: sl.id, subjectId: sl.subjectId, date: TODAY, scheduledStart: sl.start, status: 'pending' });
    }
  }
  return { ...data, records: recs };
}

/* ---- end-of-day review: backfill past class-days so nothing is silently missed ---- */
export function materializePast(data: AppData): AppData {
  const term = currentTerm(data);
  if (!term) return data;
  const recs = [...data.records];
  const activeSub = new Set(data.subjects.filter(s => s.active && s.termId === term.id).map(s => s.id));
  // window: from term start (if not ancient) else the last 21 days, up to yesterday
  const floor = addDays(TODAY, -60);
  const start = term.start > floor ? term.start : addDays(TODAY, -21);
  const have = new Set(recs.map(r => r.slotId + '|' + r.date));
  let d = start;
  while (d < TODAY) {
    const dow = parseISO(d).getDay();
    for (const sl of data.slots.filter(s => s.active && s.day === dow && activeSub.has(s.subjectId))) {
      const key = sl.id + '|' + d;
      if (!have.has(key)) { recs.push({ id: uid(), slotId: sl.id, subjectId: sl.subjectId, date: d, scheduledStart: sl.start, status: 'pending' }); have.add(key); }
    }
    d = addDays(d, 1);
  }
  return { ...data, records: recs };
}
/** Past classes still marked pending (within the term) — the "catch up" list. */
export function unmarkedPast(data: AppData): Rec[] {
  const from = data.settings.termStart, to = data.settings.termEnd;
  return data.records
    .filter(r => r.status === 'pending' && r.date < TODAY && (!from || r.date >= from) && (!to || r.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date) || a.scheduledStart.localeCompare(b.scheduledStart));
}

/* ---- one date: calendar day sheet ---- */
const attendedStatus = (s: Status) => s === 'present' || s === 'late';

/** Records for one date, sorted by start time. */
export const recordsOn = (data: AppData, iso: string) =>
  data.records.filter(r => r.date === iso).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));

/** Active timetable slots that fall on this date's weekday (the "planned" day). */
export function plannedSlotsOn(data: AppData, iso: string): Slot[] {
  const term = termForDate(data, iso);
  if (!term) return [];
  const dow = parseISO(iso).getDay();
  const activeSub = new Set(data.subjects.filter(s => s.active && s.termId === term.id).map(s => s.id));
  return data.slots.filter(s => s.active && s.day === dow && activeSub.has(s.subjectId)).sort((a, b) => a.start.localeCompare(b.start));
}

/** Create pending records for a past/today date that has timetable classes but no records yet.
    Only runs when the student opens that day, so it never invents catch-up items on its own. */
export function ensureDayRecords(data: AppData, iso: string, todayISO: string = TODAY): AppData {
  if (iso > todayISO) return data;
  const have = new Set(data.records.filter(r => r.date === iso).map(r => r.slotId));
  const add: Rec[] = plannedSlotsOn(data, iso)
    .filter(sl => !have.has(sl.id))
    .map(sl => ({ id: uid(), slotId: sl.id, subjectId: sl.subjectId, date: iso, scheduledStart: sl.start, status: 'pending' as Status }));
  return add.length ? { ...data, records: [...data.records, ...add] } : data;
}

export function setRecordStatus(data: AppData, recId: string, status: Status): AppData {
  return { ...data, records: data.records.map(r => (r.id === recId ? { ...r, status, source: 'manual' } : r)) };
}

/** Every class on this date becomes a holiday (doesn't count either way). */
export function markDayHoliday(data: AppData, iso: string): AppData {
  return { ...data, records: data.records.map(r => (r.date === iso ? { ...r, status: 'holiday' as Status, source: 'manual' } : r)) };
}

/** Swap ONE class to another subject (e.g. Maths slot, but BEEE was taught).
    The planned subject is frozen for that date: no record for it, so it is neither held nor absent.
    Status resets to pending because the old mark belonged to the other subject.
    Choosing the planned subject again restores the class. */
export function changeRecSubject(data: AppData, recId: string, newSubjectId: string): AppData {
  return {
    ...data,
    records: data.records.map(r => {
      if (r.id !== recId) return r;
      const planned = r.plannedSubjectId ?? r.subjectId;
      if (newSubjectId === r.subjectId) return r;
      if (newSubjectId === planned) { const { plannedSubjectId: _p, ...rest } = r; return { ...rest, subjectId: planned, status: 'pending' as Status, source: 'manual' }; }
      return { ...r, subjectId: newSubjectId, plannedSubjectId: planned, status: 'pending' as Status, source: 'manual' };
    }),
  };
}

/** A class that isn't in the timetable (extra lecture, makeup class). */
export function addExtraClass(data: AppData, iso: string, subjectId: string, start: string, status: Status): AppData {
  const rec: Rec = { id: uid(), slotId: 'extra-' + uid(), subjectId, date: iso, scheduledStart: start, status, source: 'extra' };
  return { ...data, records: [...data.records, rec] };
}

export type DayKind = 'present' | 'absent' | 'partial' | 'off' | 'pending' | 'none';
/** How a calendar day is coloured. Late counts as attended. */
export function dayKind(recs: Rec[]): DayKind {
  if (recs.length === 0) return 'none';
  const att = recs.filter(r => attendedStatus(r.status)).length;
  const abs = recs.filter(r => r.status === 'absent').length;
  if (att + abs === 0) return recs.some(r => r.status === 'pending') ? 'pending' : 'off';
  if (abs === 0) return recs.some(r => r.status === 'pending') ? 'partial' : 'present';
  return att === 0 && !recs.some(r => r.status === 'pending') ? 'absent' : 'partial';
}

/* ---- sample data ---- */
export function seedSample(): AppData {
  const defs = [
    { name: 'Physics', color: SUBJECT_COLORS[2], p: 0.68 },
    { name: 'Chemistry', color: SUBJECT_COLORS[3], p: 0.80 },
    { name: 'Mathematics', color: SUBJECT_COLORS[1], p: 0.82 },
    { name: 'English', color: SUBJECT_COLORS[4], p: 0.86 },
    { name: 'Data Structures', color: SUBJECT_COLORS[0], p: 0.90 },
  ];
  const term: Term = { id: 'term-' + uid(), name: 'Term 1', start: addDays(TODAY, -28), end: addDays(TODAY, 92) };
  const subjects: Subject[] = defs.map(d => ({ id: uid(), name: d.name, color: d.color, active: true, termId: term.id }));
  const byName = (n: string) => subjects.find(s => s.name === n)!;
  const template: Record<number, [string, string, string, string][]> = {
    1: [['Physics', '10:00', '10:55', 'Room 204'], ['Mathematics', '12:00', '12:55', 'Room 110'], ['Data Structures', '14:00', '15:30', 'Lab 3']],
    2: [['Chemistry', '09:00', '09:55', 'Lab 1'], ['English', '11:00', '11:55', 'Room 8']],
    3: [['Physics', '10:00', '10:55', 'Room 204'], ['Mathematics', '12:00', '12:55', 'Room 110']],
    4: [['Chemistry', '09:00', '09:55', 'Lab 1'], ['Data Structures', '14:00', '15:30', 'Lab 3']],
    5: [['English', '11:00', '11:55', 'Room 8'], ['Mathematics', '12:00', '12:55', 'Room 110']],
    6: [['Physics', '10:00', '10:55', 'Room 204']],
  };
  const slots: Slot[] = [];
  for (const day of Object.keys(template).map(Number))
    for (const [name, start, end, room] of template[day])
      slots.push({ id: uid(), subjectId: byName(name).id, day, start, end, room, lat: null, lng: null, radius: 100, active: true });
  const records: Rec[] = [];
  for (let back = 28; back >= 1; back--) {
    const date = addDays(TODAY, -back), dow = parseISO(date).getDay();
    for (const sl of slots.filter(s => s.day === dow)) {
      const subName = subjects.find(s => s.id === sl.subjectId)!.name;
      const prob = defs.find(d => d.name === subName)!.p;
      records.push({ id: uid(), slotId: sl.id, subjectId: sl.subjectId, date, scheduledStart: sl.start, status: Math.random() < prob ? 'present' : 'absent', source: 'seed' });
    }
  }
  return materializeToday({ subjects, slots, records, settings: { ...DEFAULT_SETTINGS }, terms: [term], activeTermId: term.id });
}
