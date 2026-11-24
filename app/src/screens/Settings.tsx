import { useState, useEffect } from 'react';
import { View, Pressable, Switch, Platform, Linking, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Palette } from '../theme';
import { AppData, ThemePref, RoundingRule, materializeToday, TODAY, seedSample, emptyData, termView, termById, currentTerm, updateTerm } from '../logic';
import { TermPicker, overlappingTerm } from '../components/TermSheet';
import { TextInput } from '../components/AppText';
import { inputStyle } from '../components/ui';
import { Segment, Stepper, Title } from '../components/ui';
import { DateRow } from '../components/forms';
import { IS_EXPO_GO } from '../features/env';
import { validateAppData, describeData } from '../cloud/validate';
import { stashBeforeReplace, readStash, clearStash } from '../storage';
import { confirmAsync, notify } from '../components/confirm';
import { shareTextFile } from '../fileShare';
import type { SyncStatus } from '../cloud/useCloudSync';
import { backupJson } from '../backup/backupCore';
import {
  autoBackupSupported, folderSupported, getStatus, getFolder, folderLabel, writeAutoBackup,
  chooseFolder, stopFolder, listBackups, readBackup, BackupStatus, BackupEntry,
} from '../backup/autoBackup';

const GITHUB_URL = 'https://github.com/Debajit753/Attendly';

export function SettingsScreen({ pal, data, setData, cloud, goAccount }: { pal: Palette; data: AppData; setData: (u: (d: AppData | null) => AppData | null) => void; cloud: { user: { email: string; verified: boolean } | null; status: SyncStatus }; goAccount: () => void }) {
  const s = data.settings;
  // Reminders / auto check-in use the term running today (not the one being viewed).
  const nowData = termView(data, currentTerm(data)?.id ?? data.activeTermId);
  const viewed = termById(data, data.activeTermId);
  const [terms, setTerms] = useState(false);
  const [termMsg, setTermMsg] = useState<string | null>(null);
  const setTermDates = (patch: { start?: string; end?: string }) => {
    if (!viewed) return;
    const start = patch.start ?? viewed.start, end = patch.end ?? viewed.end;
    if (end < start) { setTermMsg('The end date is before the start date.'); return; }
    const clash = overlappingTerm(data, start, end, viewed.id);
    if (clash) { setTermMsg(`That overlaps ${clash.name}. Terms can't overlap.`); return; }
    setTermMsg(null);
    setData(d => (d ? materializeToday(updateTerm(d, viewed.id, { start, end })) : d));
  };
  const [undo, setUndo] = useState<{ at: string; reason: string } | null>(null);
  useEffect(() => { readStash().then(st => setUndo(st ? { at: st.at, reason: st.reason } : null)); }, []);
  // Automatic backups (phone only)
  const [bStatus, setBStatus] = useState<BackupStatus>({});
  const [folder, setFolder] = useState<string | null>(null);
  const [bBusy, setBBusy] = useState(false);
  const [backups, setBackups] = useState<BackupEntry[] | null>(null);   // non-null = restore list open
  useEffect(() => {
    if (!autoBackupSupported) return;
    getStatus().then(setBStatus);
    getFolder().then(f => setFolder(f ? folderLabel(f) : null));
  }, []);
  const setSettings = (patch: Partial<typeof s>) => setData(d => (d ? { ...d, settings: { ...d.settings, ...patch } } : d));
  const [geoOn, setGeoOn] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(IS_EXPO_GO ? "Needs a dev build — background check-in can't run in Expo Go." : null);
  useEffect(() => { if (!IS_EXPO_GO) import('../features/geofence').then(g => g.isGeofencingActive()).then(setGeoOn).catch(() => {}); }, []);
  async function toggleGeo() {
    if (IS_EXPO_GO) { setGeoNote("Needs a dev build — background check-in can't run in Expo Go."); return; }
    try {
      const g = await import('../features/geofence');
      if (geoOn) { await g.disableGeofencing(); setGeoOn(false); setGeoNote(null); return; }
      const res = await g.enableGeofencing(nowData);
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
      const res = await r.scheduleReminders(nowData, lead);
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
      try { const r = await import('../features/reminders'); const res = await r.scheduleReminders(nowData, next); if (res.ok) setRemNote(`On — ${res.count} weekly ${res.count === 1 ? 'reminder' : 'reminders'} set, ${next} min before class.`); } catch { /* ignore */ }
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
    try { await shareTextFile(`attendly-backup-${TODAY}.json`, backupJson(data)); }
    catch (e: any) { notify('Backup failed', String(e?.message ?? e)); }
  }
  /** Replace everything, but keep a one-step undo copy of what was there. */
  async function replaceAll(next: AppData, reason: string) {
    try { await stashBeforeReplace(data, reason); }
    catch { notify('Nothing changed', "Couldn't save an undo copy first, so your data was left as it is."); return false; }
    setData(() => next);
    setUndo({ at: new Date().toISOString(), reason });
    return true;
  }
  async function importData() {
    let text: string;
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const uri = res.assets[0].uri;
      text = Platform.OS === 'web' ? await (await fetch(uri)).text() : await FileSystem.readAsStringAsync(uri);
    } catch (e: any) { notify("Couldn't open the file", String(e?.message ?? e)); return; }
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { notify('Not a backup file', "This file isn't valid JSON."); return; }
    const checked = validateAppData(parsed);
    if (!checked.ok) { notify('Not a valid backup', checked.error); return; }
    const skipped = checked.dropped ? `
${checked.dropped} damaged entries will be skipped.` : '';
    const ok = await confirmAsync('Restore this backup?',
      `Backup: ${describeData(checked.data)}.${skipped}

This replaces what's on this phone now (${describeData(data)}). You can undo it once from Settings.`, 'Restore');
    if (ok) await replaceAll(materializeToday(checked.data), 'restore');
  }
  async function backupNow() {
    setBBusy(true);
    try { setBStatus(await writeAutoBackup(data)); }
    catch (e: any) { notify('Backup failed', String(e?.message ?? e)); }
    finally { setBBusy(false); }
  }
  async function pickFolder() {
    try {
      const label = await chooseFolder(data);
      if (label) { setFolder(label); setBStatus(await getStatus()); }
    } catch (e: any) { notify("Couldn't use that folder", String(e?.message ?? e)); }
  }
  async function removeFolder() {
    const ok = await confirmAsync('Stop using the backup folder?', 'Backups already in that folder stay there. New backups go only to the app.', 'Stop', false);
    if (!ok) return;
    await stopFolder(); setFolder(null); setBStatus(await getStatus());
  }
  async function openBackups() { setBackups(await listBackups()); }
  async function restoreFrom(b: BackupEntry) {
    const checked = await readBackup(b.uri);
    if (!checked.ok) { notify('Not a valid backup', checked.error); return; }
    const ok = await confirmAsync(`Restore the backup from ${b.day}?`,
      `Backup: ${describeData(checked.data)}.\n\nThis replaces what's on this phone now (${describeData(data)}). You can undo it once from Settings.`, 'Restore');
    if (!ok) return;
    if (await replaceAll(materializeToday(checked.data), 'restore')) setBackups(null);
  }
  async function resetSample() {
    const ok = await confirmAsync('Replace your data with sample data?', `This replaces ${describeData(data)} with made-up sample data. You can undo it once from Settings.`, 'Replace');
    if (ok) await replaceAll(seedSample(), 'sample reset');
  }
  async function eraseAll() {
    const ok = await confirmAsync('Erase all data?', `This removes ${describeData(data)} from this phone. Your settings are kept. You can undo it once from Settings.`, 'Erase');
    if (ok) await replaceAll(materializeToday(emptyData(s)), 'erase');
  }
  async function undoReplace() {
    const st = await readStash();
    if (!st) { setUndo(null); notify('Nothing to undo', 'The undo copy is no longer available.'); return; }
    const ok = await confirmAsync('Undo last change?', `Go back to the data from before the ${st.reason} (${describeData(st.data)})?`, 'Undo', false);
    if (!ok) return;
    setData(() => materializeToday(st.data));
    await clearStash();
    setUndo(null);
  }

  return (
    <View>
      <Title pal={pal}>Settings</Title>

      <Text style={grpLabel}>ACCOUNT AND SYNC</Text>
      <View style={grpCard}>
        <Pressable onPress={goAccount} style={({ pressed }) => [row(true), pressed && { opacity: 0.5 }]}>
          <Ionicons name={cloud.user ? 'cloud-done-outline' : 'cloud-outline'} size={19} color={pal.brand} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: pal.text, fontSize: 15 }} numberOfLines={1}>{cloud.user ? cloud.user.email : 'Sign in to sync'}</Text>
            <Text style={{ color: cloud.status.state === 'error' ? pal.dangerText : pal.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {!cloud.user ? 'Optional: keep a cloud copy and move to a new phone'
                : cloud.status.state === 'unverified' ? 'Verify your email to turn on sync'
                : cloud.status.state === 'error' ? cloud.status.message
                : cloud.status.state === 'syncing' ? 'Syncing…' : 'Sync is on'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={pal.textMuted} />
        </Pressable>
      </View>

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
      {viewed && (
        <View style={grpCard}>
          <View style={row(false)}>
            <Text style={{ color: pal.text, fontSize: 15, flex: 1 }}>Name</Text>
            <TextInput value={viewed.name} maxLength={40} onChangeText={(v) => setData(d => (d ? updateTerm(d, viewed.id, { name: v }) : d))}
              onEndEditing={() => { if (!viewed.name.trim()) setData(d => (d ? updateTerm(d, viewed.id, { name: 'Term' }) : d)); }}
              style={[inputStyle(pal), { width: 170, paddingVertical: 8, fontSize: 15, textAlign: 'right' }]} />
          </View>
          <DateRow pal={pal} label="Starts" hint="your % counts from this day" value={viewed.start} onChange={(v) => v && setTermDates({ start: v })} last={false} />
          <DateRow pal={pal} label="Ends" hint="the Bunk tab projects to this day" value={viewed.end} onChange={(v) => v && setTermDates({ end: v })} last={false} />
          <Pressable onPress={() => setTerms(true)} style={({ pressed }) => [row(true), pressed && { opacity: 0.5 }]}>
            <Ionicons name="layers-outline" size={18} color={pal.brand} />
            <Text style={{ color: pal.text, fontSize: 15, flex: 1, marginLeft: 10 }}>All terms · start a new term</Text>
            <Text style={{ color: pal.textMuted, fontSize: 13, marginRight: 6 }}>{data.terms.length}</Text>
            <Ionicons name="chevron-forward" size={16} color={pal.textMuted} />
          </Pressable>
        </View>
      )}
      {termMsg && <Text style={{ color: pal.dangerText, fontSize: 12.5, marginTop: 8, marginHorizontal: 6 }}>{termMsg}</Text>}
      <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 8, marginHorizontal: 6, lineHeight: 17 }}>
        Each term keeps its own subjects, timetable, attendance and streak. Use All terms to switch terms or start a new one.
      </Text>
      {terms && <TermPicker pal={pal} data={data} setData={setData} onClose={() => setTerms(false)} />}

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
      <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 8, marginHorizontal: 6, lineHeight: 17 }}>Create backup saves a `.json` file through the share sheet, so you can keep it in Drive or email. Restore backup accepts that file and the automatic ones below.</Text>

      <Text style={grpLabel}>AUTOMATIC BACKUPS</Text>
      {!autoBackupSupported ? (
        <Text style={{ color: pal.textMuted, fontSize: 12.5, marginHorizontal: 6, lineHeight: 17 }}>Automatic backups run in the phone app. On the web, use Create backup.</Text>
      ) : (
        <View style={grpCard}>
          <View style={row(false)}>
            <Ionicons name="time-outline" size={19} color={pal.brand} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: pal.text, fontSize: 15 }}>Daily backup on this phone</Text>
              <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 2 }}>{bStatus.lastAt ? `Last saved ${new Date(bStatus.lastAt).toLocaleString()}` : 'Saved automatically after changes'} · last 7 days kept</Text>
            </View>
            <Pressable onPress={backupNow} disabled={bBusy} hitSlop={8}>
              {bBusy ? <ActivityIndicator color={pal.brand} /> : <Text style={{ color: pal.brand, fontWeight: '600' }}>Back up now</Text>}
            </Pressable>
          </View>
          <Pressable onPress={openBackups} style={({ pressed }) => [row(!folderSupported), pressed && { opacity: 0.5 }]}>
            <Ionicons name="arrow-undo-circle-outline" size={19} color={pal.brand} />
            <Text style={{ color: pal.text, fontSize: 15, flex: 1, marginLeft: 10 }}>Restore an automatic backup</Text>
            <Ionicons name="chevron-forward" size={16} color={pal.textMuted} />
          </Pressable>
          {folderSupported && (
            <View style={row(true)}>
              <Ionicons name="folder-open-outline" size={19} color={pal.brand} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: pal.text, fontSize: 15 }}>Backup folder</Text>
                <Text style={{ color: bStatus.folderError ? pal.dangerText : pal.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 }} numberOfLines={2}>
                  {bStatus.folderError ?? (folder ? `Also saving to ${folder}` : 'Optional: also save to a folder you pick. Survives uninstalling the app.')}
                </Text>
              </View>
              <Pressable onPress={pickFolder} hitSlop={8}><Text style={{ color: pal.brand, fontWeight: '600' }}>{folder ? 'Change' : 'Choose'}</Text></Pressable>
              {folder && <Pressable onPress={removeFolder} hitSlop={8} style={{ marginLeft: 14 }}><Text style={{ color: pal.textSecondary, fontWeight: '600' }}>Stop</Text></Pressable>}
            </View>
          )}
        </View>
      )}
      {backups && <BackupList pal={pal} items={backups} onPick={restoreFrom} onClose={() => setBackups(null)} />}

      <Text style={grpLabel}>YOUR DATA</Text>
      <View style={grpCard}>
        {undo && (
          <Pressable onPress={undoReplace} style={({ pressed }) => [row(false), pressed && { opacity: 0.5 }]}>
            <Ionicons name="arrow-undo-outline" size={18} color={pal.brand} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ color: pal.brand, fontSize: 15, fontWeight: '500' }}>Undo last {undo.reason}</Text>
              <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 2 }}>{new Date(undo.at).toLocaleString()}</Text>
            </View>
          </Pressable>
        )}
        <Pressable onPress={resetSample} style={({ pressed }) => [row(false), pressed && { opacity: 0.5 }]}>
          <Ionicons name="sparkles-outline" size={18} color={pal.brand} />
          <Text style={{ color: pal.brand, fontSize: 15, fontWeight: '500', marginLeft: 10 }}>Reset to sample data</Text>
        </Pressable>
        <Pressable onPress={eraseAll} style={({ pressed }) => [row(true), pressed && { opacity: 0.5 }]}>
          <Ionicons name="trash-outline" size={18} color={pal.danger} />
          <Text style={{ color: pal.danger, fontSize: 15, fontWeight: '500', marginLeft: 10 }}>Erase all data</Text>
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

function BackupList({ pal, items, onPick, onClose }: { pal: Palette; items: BackupEntry[]; onPick: (b: BackupEntry) => void; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxWidth: 480, alignSelf: 'center', width: '100%', maxHeight: '75%', backgroundColor: pal.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 }}>
        <Text style={{ color: pal.text, fontSize: 19, fontWeight: '800', marginBottom: 4 }}>Automatic backups</Text>
        <Text style={{ color: pal.textSecondary, fontSize: 13, marginBottom: 12 }}>Pick one to see what's in it before restoring.</Text>
        <ScrollView>
          {items.length === 0 && <Text style={{ color: pal.textSecondary, paddingVertical: 12 }}>No automatic backups yet. One is saved shortly after your next change.</Text>}
          {items.map(b => (
            <Pressable key={b.uri} onPress={() => onPick(b)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: pal.hair, opacity: pressed ? 0.5 : 1 })}>
              <Ionicons name={b.where === 'folder' ? 'folder-outline' : 'phone-portrait-outline'} size={18} color={pal.textSecondary} />
              <Text style={{ color: pal.text, fontSize: 15, flex: 1 }}>{new Date(b.day + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              <Text style={{ color: pal.textMuted, fontSize: 12 }}>{b.where === 'folder' ? 'backup folder' : 'this phone'}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={onClose} style={{ alignItems: 'center', paddingTop: 14 }}><Text style={{ color: pal.textSecondary, fontWeight: '600' }}>Close</Text></Pressable>
      </View>
    </Modal>
  );
}
