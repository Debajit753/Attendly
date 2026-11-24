import * as Notifications from 'expo-notifications';

/* Class-time reminders — LOCAL, on-device weekly notifications.
   NOTE: importing 'expo-notifications' runs a push side-effect that crashes
   Expo Go on Android, so this module is only ever loaded on a dev/standalone
   build (guarded by IS_EXPO_GO in App.tsx). */

// Show the banner even when the app is foregrounded.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch { /* older API / unavailable */ }

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/* A pool of varied reminder copy so notifications don't feel robotic.
   Each class gets a rotating title + body (by index) — friendly, on-brand. */
const R_TITLES: ((s: string, lead: number) => string)[] = [
  (s, lead) => `${s} in ${lead} min`,
  (s) => `Time for ${s} soon`,
  (s) => `${s} is about to start`,
  (s) => `Heads up — ${s} 👀`,
  (s, lead) => `${lead} min till ${s}`,
  (s) => `Don't bunk ${s} 😄`,
];
const R_BODIES: ((s: string, room: string, start: string) => string)[] = [
  (_s, room, start) => `Head over${room ? ' to ' + room : ''} — starts ${start}. Tap to check in.`,
  (_s, _room, start) => `Starts ${start}. A quick check-in keeps your % healthy.`,
  (_s, room, start) => `${room ? room + ' · ' : ''}${start}. Every class counts — don't skip this one.`,
  (s, _room, _start) => `Almost ${s} time. Show up and keep your streak alive.`,
  (_s, _room, _start) => `You've got this — get there and tap Check in.`,
  (_s, room, start) => `${start}${room ? ' at ' + room : ''}. Future-you will thank you.`,
];
function reminderCopy(sub: string, room: string, start: string, lead: number, idx: number) {
  return {
    title: R_TITLES[idx % R_TITLES.length](sub, lead),
    body: R_BODIES[idx % R_BODIES.length](sub, room, start),
  };
}

/** Schedule one weekly local notification per class, `leadMin` minutes before it starts. */
export async function scheduleReminders(data: any, leadMin: number = 10): Promise<{ ok: boolean; reason?: string; count?: number }> {
  try {
    const perm = await Notifications.requestPermissionsAsync();
    if (perm.status !== 'granted' && !(perm as any).granted) return { ok: false, reason: 'permission' };
    await Notifications.cancelAllScheduledNotificationsAsync();

    const subsById: Record<string, any> = {};
    for (const s of (data.subjects || [])) subsById[s.id] = s;
    const slots = (data.slots || []).filter((s: any) => s.active && subsById[s.subjectId]?.active);

    let count = 0;
    for (const sl of slots) {
      const at = toMin(sl.start) - leadMin;
      if (at < 0) continue;                          // class too early in the day to pre-warn
      const hour = Math.floor(at / 60), minute = at % 60;
      const sub = subsById[sl.subjectId];
      const copy = reminderCopy(sub?.name || 'Class', sl.room || '', sl.start, leadMin, count);
      await Notifications.scheduleNotificationAsync({
        content: { title: copy.title, body: copy.body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: sl.day + 1,                       // JS 0=Sun → expo 1=Sun
          hour,
          minute,
        },
      });
      count++;
    }
    return { ok: true, count };
  } catch {
    return { ok: false, reason: 'unsupported' };     // needs a dev build
  }
}

export async function cancelReminders(): Promise<void> {
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* ignore */ }
}

/** Fire a one-off notification ~3s from now so you can SEE reminders work right away. */
export async function sendTestReminder(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const perm = await Notifications.requestPermissionsAsync();
    if (perm.status !== 'granted' && !(perm as any).granted) return { ok: false, reason: 'permission' };
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Attendly test ✓', body: 'Reminders work! This is what a class heads-up will look like.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unsupported' };
  }
}
