import { useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { Text } from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../theme';
import { AppData, Projection, overallCounts, countsFor, currentPct, maxBunksNow, classesToReach, project, TODAY, limitingSubject, roundP, subjectTarget } from '../logic';
import { Title, Sub, animate, niceDate } from '../components/ui';

/* Bunk calculator, simplified: pick a subject, get one plain answer, and try
   "what if I miss N" with a stepper. End-of-term projection below. */
export function Bunk({ pal, data }: any) {
  const [subjectId, setSubjectId] = useState<string>('all');
  const [n, setN] = useState(0);
  const subs = data.subjects.filter((s: any) => s.active);
  const sub = subs.find((s: any) => s.id === subjectId);
  const T: number = sub ? subjectTarget(data, sub) : data.settings.target;
  const rule = data.settings.roundingRule;
  const { a, h } = sub ? countsFor(data, sub.id) : overallCounts(data);
  const name = sub ? sub.name : 'overall';
  const pct = currentPct(a, h);
  const fmt = (p: number) => `${roundP(p, rule)}%`;

  // The one answer that matters.
  let big: string, small: string, tone: 'safe' | 'danger' | 'neutral';
  if (h === 0) { big = 'No classes yet'; small = 'Mark a few classes and your answer appears here.'; tone = 'neutral'; }
  else if (pct >= T) {
    const skip = maxBunksNow(a, h, T);
    big = skip === Infinity ? 'Skip freely' : `Skip ${skip}`;
    small = skip === 0 ? `You're right at ${T}%. Don't miss the next class.` : `more ${skip === 1 ? 'class' : 'classes'} and ${name} stays at ${T}% or above.`;
    tone = skip === 0 ? 'danger' : 'safe';
  } else {
    const need = classesToReach(a, h, T);
    big = need == null ? 'Not reachable' : `Attend ${need}`;
    small = need == null ? `${name} can't get back to ${T}% this term.` : `${need === 1 ? 'class' : 'classes'} in a row to bring ${name} back to ${T}%.`;
    tone = 'danger';
  }
  const bg = tone === 'safe' ? pal.safeBg : tone === 'danger' ? pal.dangerBg : pal.surfaceAlt;
  const fg = tone === 'safe' ? pal.safeText : tone === 'danger' ? pal.dangerText : pal.textSecondary;

  const after = currentPct(a, h + n);
  const lim = !sub ? limitingSubject(data) : null;
  const step = (icon: any, onPress: () => void) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: pal.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={icon} size={20} color={pal.brand} />
    </Pressable>
  );

  return (
    <View>
      <Title pal={pal}>Bunk calculator</Title>
      <Sub pal={pal}>Can I skip, and how many?</Sub>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }} style={{ marginBottom: 14 }}>
        {[{ id: 'all', name: 'Overall' }, ...subs].map((o: any) => {
          const on = o.id === subjectId;
          return (
            <Pressable key={o.id} onPress={() => { animate(); setSubjectId(o.id); setN(0); }} style={({ pressed }) => ({ backgroundColor: on ? pal.brand : pal.surfaceAlt, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, maxWidth: 220, opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ color: on ? '#fff' : pal.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{o.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ backgroundColor: bg, borderRadius: 16, padding: 22, alignItems: 'center' }}>
        <Text style={{ color: fg, fontWeight: '800', fontSize: 34, letterSpacing: -0.8, textAlign: 'center' }}>{big}</Text>
        <Text style={{ color: fg, fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>{small}</Text>
        {h > 0 && <Text style={{ color: pal.textSecondary, fontSize: 12.5, marginTop: 12 }}>Now {fmt(pct)} · {a} of {h} attended · target {T}%</Text>}
      </View>

      {h > 0 && (
        <View style={{ backgroundColor: pal.surface, borderRadius: 16, padding: 16, marginTop: 14 }}>
          <Text style={{ color: pal.textSecondary, fontWeight: '600', fontSize: 13 }}>What if I miss…</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
            {step('remove', () => setN(v => Math.max(0, v - 1)))}
            <Text style={{ color: pal.text, fontWeight: '800', fontSize: 22, minWidth: 30, textAlign: 'center' }}>{n}</Text>
            {step('add', () => setN(v => Math.min(50, v + 1)))}
            <Text style={{ color: pal.textSecondary, fontSize: 13 }}>{n === 1 ? 'class' : 'classes'}</Text>
            <View style={{ flex: 1 }} />
            <Text style={{ color: after >= T ? pal.safeText : pal.dangerText, fontWeight: '800', fontSize: 20 }}>{fmt(after)}</Text>
          </View>
          {n > 0 && <Text style={{ color: after >= T ? pal.safeText : pal.dangerText, fontSize: 12.5, marginTop: 8 }}>{after >= T ? `Still at or above ${T}%.` : `Below ${T}%.`}</Text>}
        </View>
      )}

      {lim && (
        <Pressable onPress={() => { animate(); setSubjectId(lim.s.id); setN(0); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: pal.surface, borderRadius: 14, padding: 14, marginTop: 14, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: lim.s.color }} />
          <Text style={{ color: pal.text, fontSize: 13.5, flex: 1 }} numberOfLines={2}><Text style={{ fontWeight: '700' }}>{lim.s.name}</Text> is your tightest subject ({lim.budget <= 0 ? 'no skips left' : `${lim.budget} skip${lim.budget === 1 ? '' : 's'} left`}).</Text>
          <Ionicons name="chevron-forward" size={16} color={pal.textMuted} />
        </Pressable>
      )}

      <ProjectionCard pal={pal} data={data} subjectId={sub ? sub.id : null} name={name} termEnd={data.settings.termEnd} target={T} />
    </View>
  );
}
export function ProjectionCard({ pal, data, subjectId, name, termEnd, target }: { pal: Palette; data: AppData; subjectId: string | null; name: string; termEnd?: string; target?: number }) {
  const box = { backgroundColor: pal.surface, borderRadius: 16, padding: 18, marginTop: 20 } as const;
  if (!termEnd) {
    return (
      <View style={[box, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
        <Ionicons name="calendar-outline" size={20} color={pal.textMuted} />
        <Text style={{ color: pal.textSecondary, fontSize: 13, flex: 1, lineHeight: 19 }}>Set your term dates in Settings to see where {name === 'overall' ? 'you' : name} will land by the end of term.</Text>
      </View>
    );
  }
  const T = target ?? data.settings.target;
  const p: Projection = project(data, subjectId, TODAY, termEnd, T);
  const head = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text style={{ color: pal.text, fontWeight: '800', fontSize: 16 }}>By end of term</Text>
      <Text style={{ color: pal.textMuted, fontSize: 12 }}>{niceDate(termEnd)}</Text>
    </View>
  );
  if (p.future <= 0) {
    return <View style={box}>{head}<Text style={{ color: pal.textSecondary, fontSize: 13.5, lineHeight: 20, marginTop: 4 }}>No more {name === 'overall' ? 'classes' : name + ' classes'} before term ends — you'll finish around {Math.round(currentPct(p.a, p.h))}%.</Text></View>;
  }
  let insight: string; let tone: string; let icon: any;
  if (!p.recoverable) { tone = pal.danger; icon = 'warning'; insight = `Even attending all ${p.future} left, you'd finish at ${Math.round(p.finalIfAll)}% — below ${T}%.`; }
  else if (p.alreadySafe) { tone = pal.brand; icon = 'shield-checkmark'; insight = `You'll stay above ${T}% even if you skip every one of the ${p.future} left.`; }
  else { tone = pal.brand; icon = 'information-circle'; insight = `You can skip up to ${p.canSkip} of the ${p.future} left and still finish at ${T}%+.`; }
  return (
    <View style={box}>
      {head}
      <Text style={{ color: pal.textSecondary, fontSize: 12.5, marginBottom: 14 }}>{p.future} {p.future === 1 ? 'class' : 'classes'} left in {name}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, backgroundColor: pal.brandSubtle, borderRadius: 12, padding: 14 }}>
          <Text style={{ color: pal.textSecondary, fontSize: 11.5, fontWeight: '600' }}>Attend all</Text>
          <Text style={{ color: pal.brand, fontWeight: '800', fontSize: 26, marginTop: 2, letterSpacing: -0.5 }}>{Math.round(p.finalIfAll)}%</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: pal.surfaceAlt, borderRadius: 12, padding: 14 }}>
          <Text style={{ color: pal.textSecondary, fontSize: 11.5, fontWeight: '600' }}>Skip all</Text>
          <Text style={{ color: p.finalIfNone >= T ? pal.text : pal.danger, fontWeight: '800', fontSize: 26, marginTop: 2, letterSpacing: -0.5 }}>{Math.round(p.finalIfNone)}%</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14 }}>
        <Ionicons name={icon} size={16} color={tone} style={{ marginTop: 1 }} />
        <Text style={{ color: tone, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 }}>{insight}</Text>
      </View>
    </View>
  );
}
