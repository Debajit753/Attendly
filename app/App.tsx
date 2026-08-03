import React, { useEffect, useState } from 'react';
import { View, Pressable, ScrollView, useColorScheme, ActivityIndicator } from 'react-native';
import { Text } from './src/components/AppText';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT, DARK, Palette } from './src/theme';
import { SF_FONTS } from './src/fonts';
import { AppData, Status, ThemePref, DEFAULT_SETTINGS, seedSample, materializeToday, materializePast } from './src/logic';
import { animate } from './src/components/ui';
import { IS_EXPO_GO } from './src/features/env';
import { Today } from './src/screens/Today';
import { Stats } from './src/screens/Stats';
import { Bunk } from './src/screens/Bunk';
import { Timetable } from './src/screens/Timetable';
import { SettingsScreen } from './src/screens/Settings';

// Background geofencing needs a dev/standalone build — never load it in Expo Go
// (guarded require, resolves to the .web stub on web).
if (!IS_EXPO_GO) {
  try { require('./src/features/geofence'); } catch {}
}

const STORE_KEY = 'bunksmart:data';
type Screen = 'today' | 'stats' | 'bunk' | 'time' | 'settings';

export default function App() {
  const sys = useColorScheme();
  const [data, setData] = useState<AppData | null>(null);
  const [screen, setScreen] = useState<Screen>('today');
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [fontsLoaded] = useFonts(SF_FONTS);
  const pref: ThemePref = data?.settings.themePref ?? 'light';
  const isDark = pref === 'dark' || (pref === 'system' && sys === 'dark');
  const pal = isDark ? DARK : LIGHT;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        if (raw) { const d = JSON.parse(raw); d.settings = { ...DEFAULT_SETTINGS, ...d.settings }; setData(materializePast(materializeToday(d))); }
        else setNeedsOnboarding(true);
      } catch { setNeedsOnboarding(true); }
    })();
  }, []);
  useEffect(() => { if (data) AsyncStorage.setItem(STORE_KEY, JSON.stringify(data)).catch(() => {}); }, [data]);

  const finishOnboarding = (sample: boolean) => {
    setData(sample ? seedSample() : materializeToday({ subjects: [], slots: [], records: [], settings: { ...DEFAULT_SETTINGS } }));
    setNeedsOnboarding(false);
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

  const mark = (recId: string, status: Status) => {
    animate();
    setData(d => (d ? { ...d, records: d.records.map(r => (r.id === recId ? { ...r, status, source: 'manual' } : r)) } : d));
  };

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ color: pal.brand, fontWeight: '800', fontSize: 15 }}>Attendly</Text>
          <Pressable onPress={() => setScreen(screen === 'settings' ? 'today' : 'settings')} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Ionicons name={screen === 'settings' ? 'settings' : 'settings-outline'} size={20} color={screen === 'settings' ? pal.brand : pal.textSecondary} />
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {screen === 'today' && <Today pal={pal} data={data} mark={mark} goStats={() => setScreen('stats')} goTime={() => setScreen('time')} />}
          {screen === 'stats' && <Stats pal={pal} data={data} />}
          {screen === 'bunk' && <Bunk pal={pal} data={data} />}
          {screen === 'time' && <Timetable pal={pal} data={data} setData={setData} />}
          {screen === 'settings' && <SettingsScreen pal={pal} data={data} setData={setData} />}
        </ScrollView>

        <TabBar pal={pal} screen={screen} setScreen={setScreen} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
export const ONB: { icon: keyof typeof Ionicons.glyphMap; h: string; p: string }[] = [
  { icon: 'eye-outline', h: 'Know if you can skip today', p: "One glance tells you if you're safe — and exactly how many classes you can miss and still clear the line." },
  { icon: 'calculator-outline', h: 'Never do the 75% maths again', p: 'A live calculator answers "can I skip?" and "what must I attend?" in real time, per subject.' },
  { icon: 'lock-closed-outline', h: 'Yours, and only yours', p: 'Everything stays on this device. No account, no sign-up, nothing uploaded — ever.' },
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
