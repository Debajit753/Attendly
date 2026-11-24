import { useEffect, useRef, useState } from 'react';
import { View, Pressable, ScrollView, useColorScheme, ActivityIndicator, AppState, Modal } from 'react-native';
import { Text } from './src/components/AppText';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { LIGHT, DARK, Palette } from './src/theme';
import { SF_FONTS } from './src/fonts';
import { AppData, Status, ThemePref, seedSample, materializeToday, materializePast, changeRecSubject, refreshToday, emptyData, termView, termById, currentTerm, latestTerm, TODAY } from './src/logic';
import { TermPicker } from './src/components/TermSheet';
import { niceDate } from './src/components/ui';
import { loadData, saveData, keepDamaged } from './src/storage';
import { confirmAsync, notify } from './src/components/confirm';
import { ConfirmHost } from './src/components/ConfirmHost';
import { writeAutoBackup } from './src/backup/autoBackup';
import { shareTextFile } from './src/fileShare';
import { animate } from './src/components/ui';
import { IS_EXPO_GO } from './src/features/env';
import { Today } from './src/screens/Today';
import { Stats } from './src/screens/Stats';
import { Bunk } from './src/screens/Bunk';
import { Timetable } from './src/screens/Timetable';
import { SettingsScreen } from './src/screens/Settings';
import { AccountScreen } from './src/screens/Account';
import { useCloudSync, Conflict } from './src/cloud/useCloudSync';

// Background geofencing needs a dev/standalone build — never load it in Expo Go
// (guarded require, resolves to the .web stub on web).
if (!IS_EXPO_GO) {
  try { require('./src/features/geofence'); } catch {}
}

type Screen = 'today' | 'stats' | 'bunk' | 'time' | 'settings' | 'account';

export default function App() {
  const sys = useColorScheme();
  const [data, setData] = useState<AppData | null>(null);
  const [screen, setScreen] = useState<Screen>('today');
  const [termSheet, setTermSheet] = useState<'new' | null>(null);   // the banner's "Start new term"
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  // Set when the saved data could not be read. The app then shows a recovery screen and
  // NEVER saves, so a bad read can't overwrite the real data.
  const [loadError, setLoadError] = useState<{ raw: string | null; message: string } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const canSave = useRef(false);
  // Cloud sync only runs on data that loaded cleanly (never after a failed load).
  const cloud = useCloudSync(data, setData, !!data && !loadError);
  const [fontsLoaded] = useFonts(SF_FONTS);
  const pref: ThemePref = data?.settings.themePref ?? 'light';
  const isDark = pref === 'dark' || (pref === 'system' && sys === 'dark');
  const pal = isDark ? DARK : LIGHT;

  const load = async () => {
    setLoadError(null);
    const res = await loadData();
    if (res.kind === 'empty') { canSave.current = true; setNeedsOnboarding(true); }
    else if (res.kind === 'error') { canSave.current = false; setLoadError({ raw: res.raw, message: res.message }); }
    else { canSave.current = true; setData(materializePast(materializeToday(res.data))); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!data || !canSave.current) return;
    saveData(data).then(ok => setSaveFailed(!ok));
  }, [data]);

  // Automatic backup: 15 s after the last change, and at once when the app goes to the
  // background. Never after a failed load (canSave is false then).
  const dataRef = useRef<AppData | null>(null);
  dataRef.current = data;
  useEffect(() => {
    if (!data || !canSave.current) return;
    const t = setTimeout(() => { writeAutoBackup(data).catch(() => {}); }, 15_000);
    return () => clearTimeout(t);
  }, [data]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'background' && dataRef.current && canSave.current) writeAutoBackup(dataRef.current).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // Roll "today" over after midnight: on return to the app, and once a minute while open.
  useEffect(() => {
    const roll = () => { if (refreshToday()) setData(d => (d ? materializeToday(d) : d)); };
    const sub = AppState.addEventListener('change', st => { if (st === 'active') roll(); });
    const timer = setInterval(roll, 60_000);
    return () => { sub.remove(); clearInterval(timer); };
  }, []);

  const finishOnboarding = (sample: boolean) => {
    canSave.current = true;
    setData(sample ? seedSample() : materializeToday(emptyData()));
    setNeedsOnboarding(false);
  };
  const exportDamaged = async () => {
    if (!loadError?.raw) return;
    try { await shareTextFile('attendly-damaged-data.json', loadError.raw); }
    catch (e: any) { notify('Could not share the file', String(e?.message ?? e)); }
  };
  const startFresh = async () => {
    const ok = await confirmAsync('Start fresh?', loadError?.raw
      ? 'Your damaged data is kept in a separate copy on this phone, but the app will start empty. Save a copy first if you want to recover it later.'
      : 'The app will start empty.', 'Start fresh');
    if (!ok) return;
    try { if (loadError?.raw) await keepDamaged(loadError.raw); }
    catch { notify('Could not keep a copy', 'Nothing was changed. Try again, or save the file first.'); return; }
    setLoadError(null);
    canSave.current = true;
    setNeedsOnboarding(true);
  };

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: pal.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={pal.brand} />
        </View>
      </SafeAreaProvider>
    );
  }
  if (loadError) {
    return (
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Recovery pal={pal} message={loadError.message} hasRaw={!!loadError.raw} onRetry={load} onExport={exportDamaged} onFresh={startFresh} />
        <ConfirmHost pal={pal} />
      </SafeAreaProvider>
    );
  }
  if (needsOnboarding) {
    return (
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Onboarding pal={pal} onFinish={finishOnboarding} />
      </SafeAreaProvider>
    );
  }
  if (!data) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: pal.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={pal.brand} />
        </View>
      </SafeAreaProvider>
    );
  }

  // Screens read only the viewed term; writes still go to the full data.
  const view = termView(data);

  const mark = (recId: string, status: Status) => {
    animate();
    setData(d => (d ? { ...d, records: d.records.map(r => (r.id === recId ? { ...r, status, source: 'manual' } : r)) } : d));
  };
  const setSubject = (recId: string, subjectId: string) => {
    animate();
    setData(d => (d ? changeRecSubject(d, recId, subjectId) : d));
  };

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ color: pal.brand, fontWeight: '800', fontSize: 15 }}>Attendly</Text>
          <Pressable onPress={() => setScreen(screen === 'settings' || screen === 'account' ? 'today' : 'settings')} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Ionicons name={screen === 'settings' || screen === 'account' ? 'settings' : 'settings-outline'} size={20} color={screen === 'settings' || screen === 'account' ? pal.brand : pal.textSecondary} />
          </Pressable>
        </View>

        <TermBanner pal={pal} data={data} setData={setData} onStartNew={() => setTermSheet('new')} />
        {saveFailed && (
          <View style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: pal.dangerBg, borderRadius: 10, padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Ionicons name="warning" size={16} color={pal.dangerText} />
            <Text style={{ color: pal.dangerText, fontSize: 12.5, flex: 1 }}>Couldn't save on this phone (storage full?). Your latest changes may be lost if you close the app.</Text>
          </View>
        )}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {screen === 'today' && <Today pal={pal} data={view} mark={mark} setSubject={setSubject} goTime={() => setScreen('time')} />}
          {screen === 'stats' && <Stats pal={pal} data={view} />}
          {screen === 'bunk' && <Bunk pal={pal} data={view} />}
          {screen === 'time' && <Timetable pal={pal} data={view} setData={setData} />}
          {screen === 'settings' && <SettingsScreen pal={pal} data={data} setData={setData} cloud={cloud} goAccount={() => setScreen('account')} />}
          {screen === 'account' && <AccountScreen pal={pal} cloud={cloud} onBack={() => setScreen('settings')} />}
        </ScrollView>

        <TabBar pal={pal} screen={screen} setScreen={setScreen} />
        {cloud.conflict && <ConflictPrompt pal={pal} conflict={cloud.conflict} />}
        <ConfirmHost pal={pal} />
        {termSheet && <TermPicker pal={pal} data={data} setData={setData} startNew onClose={() => setTermSheet(null)} />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
/** Shown when this phone and the cloud both changed the same data since the last sync. */
function ConflictPrompt({ pal, conflict }: { pal: Palette; conflict: Conflict }) {
  const opt = (label: string, note: string, onPress: () => void, primary = false) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: primary ? pal.brand : pal.surfaceAlt, borderRadius: 12, padding: 14, marginTop: 10, opacity: pressed ? 0.8 : 1 })}>
      <Text style={{ color: primary ? '#fff' : pal.text, fontWeight: '700', fontSize: 15 }}>{label}</Text>
      <Text style={{ color: primary ? '#fff' : pal.textSecondary, fontSize: 12.5, marginTop: 2, opacity: 0.9 }}>{note}</Text>
    </Pressable>
  );
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => conflict.resolve(null)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: pal.surface, borderRadius: 18, padding: 20, maxWidth: 440, width: '100%', alignSelf: 'center' }}>
          <Ionicons name="git-compare-outline" size={30} color={pal.brand} />
          <Text style={{ color: pal.text, fontSize: 19, fontWeight: '800', marginTop: 8 }}>Which copy should we keep?</Text>
          <Text style={{ color: pal.textSecondary, fontSize: 13.5, lineHeight: 20, marginTop: 4 }}>This phone and your cloud copy both have different {conflict.summary}.</Text>
          {opt('Keep this phone', "Upload this phone's version and replace the cloud copy.", () => conflict.resolve('phone'), true)}
          {opt('Keep cloud', "Replace this phone's version with the cloud copy. You can undo this once from Settings.", () => conflict.resolve('cloud'))}
          <Pressable onPress={() => conflict.resolve(null)} style={{ alignItems: 'center', paddingTop: 14 }}><Text style={{ color: pal.textSecondary, fontWeight: '600' }}>Decide later</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Explains which term you're looking at when it isn't the one running today. */
function TermBanner({ pal, data, setData, onStartNew }: { pal: Palette; data: AppData; setData: (u: (d: AppData | null) => AppData | null) => void; onStartNew: () => void }) {
  const viewed = termById(data, data.activeTermId);
  const cur = currentTerm(data);
  const last = latestTerm(data);
  if (!viewed || viewed.id === cur?.id) return null;
  const go = (id: string) => () => setData(d => (d ? { ...d, activeTermId: id } : d));
  let text: string, action = '', onPress = () => {};
  if (cur) {                                    // a term is running today, but you're viewing another
    text = viewed.start > TODAY ? `You're viewing ${viewed.name}, which hasn't started yet.` : `You're viewing ${viewed.name}, a past term.`;
    action = `Back to ${cur.name}`; onPress = go(cur.id);
  } else if (viewed.start > TODAY) {            // between terms, looking at the upcoming one
    text = `${viewed.name} starts on ${niceDate(viewed.start)}. Classes appear from that day.`;
  } else if (last && viewed.id === last.id) {   // the newest term has ended
    text = `${viewed.name} ended on ${niceDate(viewed.end)}. Start your next term to keep tracking.`;
    action = 'Start new term'; onPress = onStartNew;
  } else {                                      // an older term
    text = `You're viewing ${viewed.name}, a past term.`;
    if (last) { action = `Go to ${last.name}`; onPress = go(last.id); }
  }
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: pal.brandSubtle, borderRadius: 12, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <Ionicons name="calendar-outline" size={16} color={pal.brand} style={{ marginTop: 1 }} />
        <Text style={{ color: pal.text, fontSize: 13, flex: 1, lineHeight: 18 }}>{text}</Text>
      </View>
      {!!action && (
        <Pressable onPress={onPress} style={({ pressed }) => ({ alignSelf: 'flex-start', marginLeft: 24, backgroundColor: pal.brand, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, opacity: pressed ? 0.8 : 1 })}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Recovery({ pal, message, hasRaw, onRetry, onExport, onFresh }: { pal: Palette; message: string; hasRaw: boolean; onRetry: () => void; onExport: () => void; onFresh: () => void }) {
  const btn = (label: string, onPress: () => void, primary = false) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: primary ? pal.brand : pal.surfaceAlt, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 10, opacity: pressed ? 0.8 : 1 })}>
      <Text style={{ color: primary ? '#fff' : pal.text, fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg, padding: 24, justifyContent: 'center' }}>
      <Ionicons name="alert-circle-outline" size={52} color={pal.danger} style={{ marginBottom: 14 }} />
      <Text style={{ color: pal.text, fontSize: 26, fontWeight: '800', marginBottom: 8 }}>We couldn't open your data</Text>
      <Text style={{ color: pal.textSecondary, fontSize: 15, lineHeight: 22 }}>{message}</Text>
      <Text style={{ color: pal.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 14 }}>Nothing has been deleted or overwritten.</Text>
      {btn('Try again', onRetry, true)}
      {hasRaw && btn('Save a copy of the data', onExport)}
      {btn('Start fresh', onFresh)}
    </SafeAreaView>
  );
}

export const ONB: { icon: keyof typeof Ionicons.glyphMap; h: string; p: string }[] = [
  { icon: 'eye-outline', h: 'Know if you can skip today', p: "One glance tells you if you're safe — and exactly how many classes you can miss and still clear the line." },
  { icon: 'calculator-outline', h: 'Never do the 75% maths again', p: 'A live calculator answers "can I skip?" and "what must I attend?" in real time, per subject.' },
  { icon: 'lock-closed-outline', h: 'Yours, and only yours', p: 'Everything stays on this phone. No sign-up needed. Turn on sync later only if you want a cloud copy.' },
];
export function Onboarding({ pal, onFinish }: { pal: Palette; onFinish: (sample: boolean) => void }) {
  const [step, setStep] = useState(0);
  const isFinal = step >= ONB.length;
  const primary = ({ pressed }: { pressed: boolean }) => ({ backgroundColor: pal.brand, borderRadius: 14, paddingVertical: 16, alignItems: 'center' as const, flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 8, opacity: pressed ? 0.85 : 1 });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg, padding: 24 }}>
      {!isFinal ? (
        <>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Ionicons name={ONB[step].icon} size={54} color={pal.brand} style={{ marginBottom: 18 }} />
            <Text style={{ color: pal.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.7, marginBottom: 10 }}>{ONB[step].h}</Text>
            <Text style={{ color: pal.textSecondary, fontSize: 16, lineHeight: 24 }}>{ONB[step].p}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 18 }}>
            {ONB.map((_, i) => <View key={i} style={{ width: i === step ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: i === step ? pal.brand : pal.border }} />)}
          </View>
          <Pressable onPress={() => setStep(step + 1)} style={primary}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{step === ONB.length - 1 ? 'Get started' : 'Next'}</Text>
          </Pressable>
          <Pressable onPress={() => setStep(ONB.length)} style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ color: pal.textMuted, fontWeight: '500', fontSize: 14 }}>Skip</Text>
          </Pressable>
        </>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Ionicons name="rocket-outline" size={54} color={pal.brand} style={{ marginBottom: 18 }} />
          <Text style={{ color: pal.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.7, marginBottom: 10 }}>Let's set you up</Text>
          <Text style={{ color: pal.textSecondary, fontSize: 16, lineHeight: 24, marginBottom: 24 }}>Start with sample data to explore everything instantly, or begin with your own timetable.</Text>
          <Pressable onPress={() => onFinish(true)} style={primary}>
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Explore with sample data</Text>
          </Pressable>
          <Pressable onPress={() => onFinish(false)} style={({ pressed }) => ({ backgroundColor: pal.surfaceAlt, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: pal.text, fontWeight: '600', fontSize: 16 }}>Start with my own</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

/* ---------------- Tab bar ---------------- */
export function TabBar({ pal, screen, setScreen }: { pal: Palette; screen: Screen; setScreen: (s: Screen) => void }) {
  const tabs: { id: Screen; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'today', label: 'Today', icon: 'home' },
    { id: 'stats', label: 'Stats', icon: 'stats-chart' },
    { id: 'bunk', label: 'Bunk', icon: 'calculator' },
    { id: 'time', label: 'Timetable', icon: 'calendar' },
  ];
  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: pal.surface, borderTopWidth: 0.5, borderTopColor: pal.hair }}>
      <View style={{ flexDirection: 'row', height: 56 }}>
        {tabs.map(tb => {
          const on = tb.id === screen;
          return (
            <Pressable key={tb.id} onPress={() => setScreen(tb.id)} style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, opacity: pressed ? 0.55 : 1 })}>
              <Ionicons name={on ? tb.icon : (`${tb.icon}-outline` as any)} size={24} color={on ? pal.brand : pal.textMuted} />
              <Text style={{ color: on ? pal.brand : pal.textMuted, fontSize: 10, fontWeight: '500' }}>{tb.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
