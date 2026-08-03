import { SUBJECT_COLORS } from './theme';

export type Status = 'present' | 'late' | 'absent' | 'cancelled' | 'holiday' | 'pending';
export type Zone = 'safe' | 'warn' | 'danger' | 'building' | 'neutral';

export interface Subject { id: string; name: string; color: string; active: boolean; target?: number; }  // target: optional per-subject %
export interface Slot { id: string; subjectId: string; day: number; start: string; end: string; room: string; lat: number | null; lng: number | null; radius: number; active: boolean; }
export interface Rec { id: string; slotId: string; subjectId: string; date: string; scheduledStart: string; status: Status; source?: string; }
export type ThemePref = 'system' | 'light' | 'dark';
export type RoundingRule = 'round' | 'floor';
export interface Settings {
  target: number;
  countCancelled: boolean;
  themePref: ThemePref;
  termStart?: string;         // ISO yyyy-mm-dd, optional
  termEnd?: string;           // ISO yyyy-mm-dd, optional
  remindersOn?: boolean;      // class-time reminders (dev build only)
  reminderLead?: number;      // minutes before class to remind (default 10)
  roundingRule?: RoundingRule; // how the % is shown (some colleges truncate 74.6 → 74)
  defaultRadius?: number;     // default check-in radius, metres (default 100)
  graceMin?: number;          // minutes after start still "on time"; later = Late (default 15)
}
export interface AppData { subjects: Subject[]; slots: Slot[]; records: Rec[]; settings: Settings; }

export const DEFAULT_SETTINGS: Settings = { target: 75, countCancelled: false, themePref: 'light', reminderLead: 10, roundingRule: 'round', defaultRadius: 100, graceMin: 15 };

/** Round a % for display per the college rule (round or truncate). */
export const roundP = (p: number, rule?: RoundingRule) => (rule === 'floor' ? Math.floor(p + 1e-9) : Math.round(p));
/** The target that applies to a subject (its own, else the global default). */
export const subjectTarget = (data: AppData, s: Subject) => s.target ?? data.settings.target;

let counter = 0;
export const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

/* ---- dates ---- */
const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const TODAY = isoDate(new Date());
export const TODAY_DOW = new Date().getDay();
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
export function streaks(data: AppData) {
  const attended = (r: Rec) => r.status === 'present' || r.status === 'late';
  const byDate: Record<string, Rec[]> = {};
  for (const r of data.records) if (attended(r) || r.status === 'absent') (byDate[r.date] = byDate[r.date] || []).push(r);
  const dates = Object.keys(byDate).sort();
  let best = 0, run = 0, cur = 0;
  for (const d of dates) { if (byDate[d].every(attended)) { run++; best = Math.max(best, run); } else run = 0; }
  for (let i = dates.length - 1; i >= 0; i--) { if (byDate[dates[i]].every(attended)) cur++; else break; }
  return { current: cur, best };
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

export function project(data: AppData, subjectId: string | null, todayISO: string, termEndISO: string): Projection {
  const { a, h } = subjectId ? countsFor(data, subjectId) : overallCounts(data);
  const T = data.settings.target;
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
  const recs = [...data.records];
  const activeSub = new Set(data.subjects.filter(s => s.active).map(s => s.id));
  for (const sl of data.slots.filter(s => s.active && s.day === TODAY_DOW && activeSub.has(s.subjectId))) {
    if (!recs.find(r => r.slotId === sl.id && r.date === TODAY)) {
      recs.push({ id: uid(), slotId: sl.id, subjectId: sl.subjectId, date: TODAY, scheduledStart: sl.start, status: 'pending' });
    }
  }
  return { ...data, records: recs };
}

/* ---- end-of-day review: backfill past class-days so nothing is silently missed ---- */
export function materializePast(data: AppData): AppData {
  const recs = [...data.records];
  const activeSub = new Set(data.subjects.filter(s => s.active).map(s => s.id));
  // window: from term start (if set & not ancient) else the last 21 days, up to yesterday
  const floor = addDays(TODAY, -60);
  const start = data.settings.termStart && data.settings.termStart > floor ? data.settings.termStart : addDays(TODAY, -21);
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

/* ---- sample data ---- */
export function seedSample(): AppData {
  const defs = [
    { name: 'Physics', color: SUBJECT_COLORS[2], p: 0.68 },
    { name: 'Chemistry', color: SUBJECT_COLORS[3], p: 0.80 },
    { name: 'Mathematics', color: SUBJECT_COLORS[1], p: 0.82 },
    { name: 'English', color: SUBJECT_COLORS[4], p: 0.86 },
    { name: 'Data Structures', color: SUBJECT_COLORS[0], p: 0.90 },
  ];
  const subjects: Subject[] = defs.map(d => ({ id: uid(), name: d.name, color: d.color, active: true }));
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
  return materializeToday({ subjects, slots, records, settings: { ...DEFAULT_SETTINGS } });
}
