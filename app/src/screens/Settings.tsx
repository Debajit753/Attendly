import React, { useState, useEffect } from 'react';
import { View, Pressable, Switch, Platform, Linking } from 'react-native';
import { Text } from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Palette } from '../theme';
import { AppData, DEFAULT_SETTINGS, ThemePref, RoundingRule, materializeToday, addDays, TODAY, seedSample } from '../logic';
import { Segment, Stepper, Title, Sub } from '../components/ui';
import { DateRow } from '../components/forms';
import { IS_EXPO_GO } from '../features/env';

const GITHUB_URL = 'https://github.com/Debajit753/Attendly';

export function SettingsScreen({ pal, data, setData }: { pal: Palette; data: AppData; setData: (u: (d: AppData | null) => AppData | null) => void }) {
  const s = data.settings;
  const [confirmErase, setConfirmErase] = useState(false);
  const setSettings = (patch: Partial<typeof s>) => setData(d => (d ? { ...d, settings: { ...d.settings, ...patch } } : d));
  const [geoOn, setGeoOn] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(IS_EXPO_GO ? "Needs a dev build — background check-in can't run in Expo Go." : null);
  useEffect(() => { if (!IS_EXPO_GO) import('../features/geofence').then(g => g.isGeofencingActive()).then(setGeoOn).catch(() => {}); }, []);
  async function toggleGeo() {
    if (IS_EXPO_GO) { setGeoNote("Needs a dev build — background check-in can't run in Expo Go."); return; }
    try {
      const g = await import('../features/geofence');
      if (geoOn) { await g.disableGeofencing(); setGeoOn(false); setGeoNote(null); return; }
      const res = await g.enableGeofencing(data);
      if (res.ok) { setGeoOn(true); setGeoNote("On — you'll be auto-marked present when you reach a class during its time."); }
      else if (res.reason === 'noloc') setGeoNote('First add a location to a class (edit a class → Set your building on the map).');
      else if (res.reason === 'background') setGeoNote('Needs "Allow all the time" location. Grant it in system Settings, then try again.');
      else if (res.reason === 'foreground') setGeoNote('Location permission is required.');
      else setGeoNote("This needs a dev build — it can't run in Expo Go.");
    } catch { setGeoNote("This needs a dev build — it can't run in Expo Go."); }
  }

  // Class-time reminders (dev build only — expo-notifications crashes Expo Go)
  const [remOn, setRemOn] = useState(!!s.remindersOn);
  const lead = s.reminderLead ?? 10;
  const [remNote, setRemNote] = useState<string | null>(IS_EXPO_GO ? "Needs a dev build — reminders can't run in Expo Go." : null);
  async function toggleRem() {
    if (IS_EXPO_GO) { setRemNote("Needs a dev build — reminders can't run in Expo Go."); return; }
    try {
      const r = await import('../features/reminders');
      if (remOn) { await r.cancelReminders(); setRemOn(false); setSettings({ remindersOn: false }); setRemNote(null); return; }
      const res = await r.scheduleReminders(data, lead);
      if (res.ok) { setRemOn(true); setSettings({ remindersOn: true }); setRemNote(`On — ${res.count} weekly ${res.count === 1 ? 'reminder' : 'reminders'} set, ${lead} min before class.`); }
      else if (res.reason === 'permission') setRemNote('Notification permission is required. Enable it in system Settings, then try again.');
      else setRemNote("This needs a dev build — it can't run in Expo Go.");
    } catch { setRemNote("This needs a dev build — it can't run in Expo Go."); }
  }
  async function changeLead(delta: number) {
    const next = Math.max(5, Math.min(60, lead + delta));
    if (next === lead) return;
    setSettings({ reminderLead: next });
    if (remOn && !IS_EXPO_GO) {
      try { const r = await import('../features/reminders'); const res = await r.scheduleReminders(data, next); if (res.ok) setRemNote(`On — ${res.count} weekly ${res.count === 1 ? 'reminder' : 'reminders'} set, ${next} min before class.`); } catch { /* ignore */ }
    }
  }
  async function testRem() {
    if (IS_EXPO_GO) { setRemNote("Needs a dev build — reminders can't run in Expo Go."); return; }
    setRemNote('Sending a test…');
    try {
      const r = await import('../features/reminders');
      const res = await r.sendTestReminder();
      if (res.ok) setRemNote('Test sent — a notification pops up in ~3s. Lock your phone or swipe down the notification shade to see it.');
      else if (res.reason === 'permission') setRemNote('Notification permission is off. Enable it for Attendly in system Settings, then try again.');
      else setRemNote("This needs a dev build — it can't run in Expo Go.");
    } catch { setRemNote("This needs a dev build — it can't run in Expo Go."); }
  }
  const grpLabel = { color: pal.textMuted, fontSize: 12.5, fontWeight: '600' as const, marginTop: 20, marginBottom: 8, marginLeft: 6 };
  const grpCard = { backgroundColor: pal.surface, borderRadius: 12, overflow: 'hidden' as const };
  const row = (last: boolean) => ({ flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: pal.hair });

  async function exportData() {
    const json = JSON.stringify({ app: 'bunksmart', version: 1, exportedAt: new Date().toISOString(), subjects: data.subjects, slots: data.slots, records: data.records, settings: data.settings }, null, 2);
    const filename = 'attendly-backup.json';
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
        return;
      }
      const uri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(uri, json);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Attendly backup' });
    } catch { /* ignore */ }
  }
  async function importData() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const uri = res.assets[0].uri;
      const text = Platform.OS === 'web' ? await (await fetch(uri)).text() : await FileSystem.readAsStringAsync(uri);
      const d = JSON.parse(text);
      if (!d.subjects) return;
      setData(() => materializeToday({ subjects: d.subjects, slots: d.slots || [], records: d.records || [], settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) } }));
    } catch { /* ignore */ }
  }

  return (
    <View>
      <Title pal={pal}>Settings</Title>

      <Text style={grpLabel}>ATTENDANCE</Text>
      <View style={grpCard}>
        <View style={row(false)}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: pal.text, fontSize: 15 }}>Target attendance</Text>
            <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 2 }}>The % you must stay above</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Stepper pal={pal} icon="remove" onPress={() => setSettings({ target: Math.max(1, s.target - 1) })} />
            <Text style={{ color: pal.text, fontWeight: '700', fontSize: 17, minWidth: 46, textAlign: 'center' }}>{s.target}%</Text>
            <Stepper pal={pal} icon="add" onPress={() => setSettings({ target: Math.min(100, s.target + 1) })} />
          </View>
        </View>
        <View style={row(true)}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: pal.text, fontSize: 15 }}>Count cancelled classes</Text>
            <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 2 }}>If on, cancelled classes count against you</Text>
          </View>
          <Switch value={s.countCancelled} onValueChange={(v) => setSettings({ countCancelled: v })}
            trackColor={{ false: pal.surfaceAlt, true: pal.brand }} thumbColor="#fff" ios_backgroundColor={pal.surfaceAlt} />
        </View>
      </View>

      <Text style={grpLabel}>TERM</Text>
      <View style={grpCard}>
        <DateRow pal={pal} label="Term start" hint="your % counts from this day" value={s.termStart} onChange={(v) => setSettings({ termStart: v })} last={false} />
        <DateRow pal={pal} label="Term end" hint="the day your semester ends" value={s.termEnd} onChange={(v) => setSettings({ termEnd: v })} last={true} />
      </View>
      <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 8, marginHorizontal: 6, lineHeight: 17 }}>
        Set both and your attendance % counts only this semester's classes — and the Bunk tab shows where you'll finish by term end.
      </Text>
      {!s.termEnd ? (
        <Pressable onPress={() => setSettings({ termEnd: addDays(TODAY, 120) })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, opacity: pressed ? 0.6 : 1 })}>
          <Ionicons name="sparkles-outline" size={14} color={pal.brand} />
          <Text style={{ color: pal.brand, fontSize: 13, fontWeight: '600' }}>Set term end ~4 months out</Text>
        </Pressable>
      ) : null}

      <Text style={grpLabel}>CHECK-IN</Text>
      <View style={grpCard}>
        <View style={row(false)}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: pal.text, fontSize: 15 }}>Default check-in radius</Text>
            <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 }}>How close counts as "here". Bigger = fewer false rejections.</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Stepper pal={pal} icon="remove" onPress={() => setSettings({ defaultRadius: Math.max(25, (s.defaultRadius ?? 100) - 25) })} />
            <Text style={{ color: pal.text, fontWeight: '700', fontSize: 15, minWidth: 58, textAlign: 'center' }}>{s.defaultRadius ?? 100}m</Text>
            <Stepper pal={pal} icon="add" onPress={() => setSettings({ defaultRadius: Math.min(500, (s.defaultRadius ?? 100) + 25) })} />
          </View>
        </View>
        <View style={row(true)}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: pal.text, fontSize: 15 }}>Grace period</Text>
            <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 }}>Check in within this of the start and you're on time — later is "Late".</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Stepper pal={pal} icon="remove" onPress={() => setSettings({ graceMin: Math.max(0, (s.graceMin ?? 15) - 5) })} />
            <Text style={{ color: pal.text, fontWeight: '700', fontSize: 15, minWidth: 58, textAlign: 'center' }}>{s.graceMin ?? 15} min</Text>
            <Stepper pal={pal} icon="add" onPress={() => setSettings({ graceMin: Math.min(60, (s.graceMin ?? 15) + 5) })} />
          </View>
        </View>
      </View>

      <Text style={grpLabel}>APPEARANCE</Text>
      <View style={[grpCard, { padding: 14 }]}>
        <Text style={{ color: pal.text, fontSize: 15 }}>Show percentages as</Text>
        <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 2, marginBottom: 10 }}>Some colleges truncate (74.6% → 74%). Match how yours counts.</Text>
        <Segment pal={pal} value={s.roundingRule ?? 'round'} options={[{ value: 'round', label: 'Rounded' }, { value: 'floor', label: 'Truncated' }]} onChange={(v) => setSettings({ roundingRule: v as RoundingRule })} />
        <View style={{ height: 14 }} />
        <Text style={{ color: pal.text, fontSize: 15, marginBottom: 10 }}>Theme</Text>
        <Segment pal={pal} value={s.themePref} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={(v) => setSettings({ themePref: v as ThemePref })} />
      </View>

      <Text style={grpLabel}>AUTOMATIC CHECK-IN (BETA)</Text>
      <View style={grpCard}>
        <View style={row(true)}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: pal.text, fontSize: 15 }}>Background auto check-in</Text>
            <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 }}>Marks you present when you reach a class during its time — no tapping. Needs a dev build; may be delayed by Android battery saver.</Text>
          </View>
          <Switch value={geoOn} onValueChange={toggleGeo} trackColor={{ false: pal.surfaceAlt, true: pal.brand }} thumbColor="#fff" ios_backgroundColor={pal.surfaceAlt} />
        </View>
      </View>
      {geoNote ? <Text style={{ color: pal.textSecondary, fontSize: 12.5, marginTop: 6, marginHorizontal: 6, lineHeight: 17 }}>{geoNote}</Text> : null}

      <Text style={grpLabel}>CLASS REMINDERS</Text>
      <View style={grpCard}>
        <View style={row(!remOn)}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: pal.text, fontSize: 15 }}>Remind me before class</Text>
            <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 }}>A local heads-up before each class so you never miss check-in. Needs a dev build.</Text>
          </View>
          <Switch value={remOn} onValueChange={toggleRem} trackColor={{ false: pal.surfaceAlt, true: pal.brand }} thumbColor="#fff" ios_backgroundColor={pal.surfaceAlt} />
        </View>
        {remOn ? (
          <>
            <View style={row(false)}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: pal.text, fontSize: 15 }}>Lead time</Text>
                <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 2 }}>How early to remind you</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Stepper pal={pal} icon="remove" onPress={() => changeLead(-5)} />
                <Text style={{ color: pal.text, fontWeight: '700', fontSize: 15, minWidth: 58, textAlign: 'center' }}>{lead} min</Text>
                <Stepper pal={pal} icon="add" onPress={() => changeLead(5)} />
              </View>
            </View>
            <Pressable onPress={testRem} style={({ pressed }) => [row(true), pressed && { opacity: 0.5 }]}>
              <Ionicons name="notifications-outline" size={18} color={pal.brand} />
              <Text style={{ color: pal.brand, fontSize: 15, fontWeight: '500', marginLeft: 10 }}>Send a test reminder now</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      {remNote ? <Text style={{ color: pal.textSecondary, fontSize: 12.5, marginTop: 6, marginHorizontal: 6, lineHeight: 17 }}>{remNote}</Text> : null}

      <Text style={grpLabel}>BACKUP & RESTORE</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={exportData} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: pal.surface, borderWidth: 1, borderColor: pal.border, borderRadius: 12, paddingVertical: 16, opacity: pressed ? 0.6 : 1 })}>
          <Ionicons name="download-outline" size={17} color={pal.brand} />
          <Text style={{ color: pal.text, fontSize: 14.5, fontWeight: '600' }}>Create backup</Text>
        </Pressable>
        <Pressable onPress={importData} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: pal.surface, borderWidth: 1, borderColor: pal.border, borderRadius: 12, paddingVertical: 16, opacity: pressed ? 0.6 : 1 })}>
          <Ionicons name="cloud-upload-outline" size={17} color={pal.brand} />
          <Text style={{ color: pal.text, fontSize: 14.5, fontWeight: '600' }}>Restore backup</Text>
        </Pressable>
      </View>
      <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 8, marginHorizontal: 6, lineHeight: 17 }}>Create saves a `.json` file via the share sheet — a manual backup you can keep in Drive/email. Keep a copy somewhere safe; it's the only way to move your data to a new phone.</Text>

      <Text style={grpLabel}>YOUR DATA</Text>
      <View style={grpCard}>
        <Pressable onPress={() => setData(() => seedSample())} style={({ pressed }) => [row(false), pressed && { opacity: 0.5 }]}>
          <Ionicons name="sparkles-outline" size={18} color={pal.brand} />
          <Text style={{ color: pal.brand, fontSize: 15, fontWeight: '500', marginLeft: 10 }}>Reset to sample data</Text>
        </Pressable>
        <Pressable
          onPress={() => { if (confirmErase) { setData(() => materializeToday({ subjects: [], slots: [], records: [], settings: s })); setConfirmErase(false); } else setConfirmErase(true); }}
          style={({ pressed }) => [row(true), pressed && { opacity: 0.5 }]}>
          <Ionicons name="trash-outline" size={18} color={pal.danger} />
          <Text style={{ color: pal.danger, fontSize: 15, fontWeight: '500', marginLeft: 10 }}>{confirmErase ? 'Tap again to erase everything' : 'Erase all data'}</Text>
        </Pressable>
      </View>

      <Text style={grpLabel}>ABOUT</Text>
      <View style={grpCard}>
        <Pressable onPress={() => Linking.openURL(GITHUB_URL).catch(() => {})} style={({ pressed }) => [row(false), pressed && { opacity: 0.5 }]}>
          <Ionicons name="logo-github" size={19} color={pal.text} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: pal.text, fontSize: 15 }}>View on GitHub</Text>
            <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 2 }}>Source code, issues & updates</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={pal.textMuted} />
        </Pressable>
        <View style={row(true)}>
          <Text style={{ color: pal.text, fontSize: 15, flex: 1 }}>Version</Text>
          <Text style={{ color: pal.textMuted, fontSize: 14 }}>1.0.0</Text>
        </View>
      </View>

      <Text style={{ color: pal.textMuted, fontSize: 12.5, textAlign: 'center', marginTop: 14 }}>Attendly · runs entirely on this device.</Text>
    </View>
  );
}
