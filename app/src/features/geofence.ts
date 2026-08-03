import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const GEOFENCE_TASK = 'bunksmart-geofence';
const STORE_KEY = 'bunksmart:data';
const pad = (n: number) => String(n).padStart(2, '0');
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/* Background task: fires when the phone ENTERS a class geofence.
   It only marks present if NOW is inside that class's time window today. */
try {
  TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
    if (error || !data) return;
    if (data.eventType !== Location.GeofencingEventType.Enter) return;
    const slotId: string | undefined = data.region?.identifier;
    if (!slotId) return;
    try {
      const raw = await AsyncStorage.getItem(STORE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      const slot = (d.slots || []).find((s: any) => s.id === slotId);
      if (!slot) return;
      const now = new Date();
      if (now.getDay() !== slot.day) return;                       // not this class's weekday
      const mins = now.getHours() * 60 + now.getMinutes();
      if (mins < toMin(slot.start) - 10 || mins > toMin(slot.end)) return; // outside the class window (10-min early grace)
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const rec = (d.records || []).find((r: any) => r.slotId === slotId && r.date === today);
      if (!rec || rec.status !== 'pending') return;                // no pending class to mark
      rec.status = 'present';
      rec.source = 'geofence';
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(d));
      const sub = (d.subjects || []).find((s: any) => s.id === slot.subjectId);
      try {
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Checked in ✓', body: `Auto-marked present for ${sub?.name || 'class'} (${slot.room || 'class'}).` },
          trigger: null,
        });
      } catch { /* notifications optional */ }
    } catch { /* ignore */ }
  });
} catch { /* TaskManager unavailable (e.g. Expo Go) */ }

/** Turn on background geofencing for all classes that have a saved location. */
export async function enableGeofencing(data: any): Promise<{ ok: boolean; reason?: string }> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return { ok: false, reason: 'foreground' };
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return { ok: false, reason: 'background' };
    try { await Notifications.requestPermissionsAsync(); } catch { /* optional */ }
    const regions = (data.slots || [])
      .filter((s: any) => s.lat != null && s.active !== false)
      .map((s: any) => ({ identifier: s.id, latitude: s.lat, longitude: s.lng, radius: Math.max(50, s.radius || 100), notifyOnEnter: true, notifyOnExit: false }));
    if (regions.length === 0) return { ok: false, reason: 'noloc' };
    if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) await Location.stopGeofencingAsync(GEOFENCE_TASK);
    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unsupported' }; // needs a dev build (not Expo Go)
  }
}

export async function disableGeofencing(): Promise<void> {
  try { if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) await Location.stopGeofencingAsync(GEOFENCE_TASK); } catch { /* ignore */ }
}

export async function isGeofencingActive(): Promise<boolean> {
  try { return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK); } catch { return false; }
}
