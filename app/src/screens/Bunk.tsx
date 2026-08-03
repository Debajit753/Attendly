import React, { useState } from 'react';
import { View, Pressable, Platform } from 'react-native';
import { Text } from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Palette } from '../theme';
import { AppData, Projection, overallCounts, countsFor, currentPct, maxBunksNow, classesToReach, project, TODAY, limitingSubject } from '../logic';
import { Segment, Title, Sub, animate, niceDate } from '../components/ui';

export function Bunk({ pal, data }: any) {
  const [mode, setMode] = useState<'skip' | 'attend'>('skip');
  const [subjectId, setSubjectId] = useState<string>('all');
  const [n, setN] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const T = data.settings.target;
  const subs = data.subjects.filter((s: any) => s.active);
  const ah = subjectId === 'all' ? overallCounts(data) : (() => { const c = countsFor(data, subjectId); return { a: c.a, h: c.h }; })();
  const name = subjectId === 'all' ? 'overall' : subs.find((s: any) => s.id === subjectId)?.name ?? 'this subject';

  let big: string, small: string, safe: boolean;
  if (mode === 'skip') {
    const proj = currentPct(ah.a, ah.h + n), budget = maxBunksNow(ah.a, ah.h, T);
    big = n === 0 ? `You can skip ${budget === Infinity ? '∞' : budget}` : `→ ${Math.round(proj)}%`;
    small = n === 0 ? `more ${budget === 1 ? 'class' : 'classes'} in ${name} and stay above ${T}%.` : proj >= T ? `Still safe — ${name} stays at ${Math.round(proj)}%.` : `Drops ${name} to ${Math.round(proj)}% — below ${T}%.`;
    safe = n === 0 || proj >= T;
  } else {
    const proj = currentPct(ah.a + n, ah.h + n), need = classesToReach(ah.a, ah.h, T);
    big = n === 0 ? (need === 0 ? `Already at ${T}%+` : need == null ? 'Unreachable' : `Attend ${need}`) : `→ ${Math.round(proj)}%`;
    small = n === 0 ? (need === 0 ? `${name} is safe — attend more to build a buffer.` : need == null ? `Can't reach ${T}% in ${name} this term.` : `classes in a row to bring ${name} to ${T}%.`) : `${name} climbs to ${Math.round(proj)}%.`;
    safe = proj >= T;
  }

  return (
    <View>
      <Title pal={pal}>Bunk calculator</Title>
      <Sub pal={pal}>Answers the question you actually have</Sub>

      {(() => {
        const ordered = [{ id: 'all', name: 'Overall' }, ...subs];
        const shown = expanded ? ordered : [...ordered.filter((o: any) => o.id === subjectId), ...ordered.filter((o: any) => o.id !== subjectId)].slice(0, 3);
        return (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            {shown.map((o: any) => {
              const on = o.id === subjectId;
              return (
                <Pressable key={o.id} onPress={() => { animate(); setSubjectId(o.id); setN(0); }} style={({ pressed }) => ({ backgroundColor: on ? pal.brand : pal.surfaceAlt, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
                  <Text style={{ color: on ? '#fff' : pal.text, fontWeight: '600', fontSize: 13 }}>{o.name}</Text>
                </Pressable>
              );
            })}
            {ordered.length > 3 && (
              <Pressable onPress={() => { animate(); setExpanded(e => !e); }} style={({ pressed }) => ({ marginLeft: 'auto', width: 36, height: 36, borderRadius: 18, backgroundColor: pal.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={pal.brand} />
              </Pressable>
            )}
          </View>
        );
      })()}

      {subjectId === 'all' && (() => {
        const lim = limitingSubject(data);
        if (!lim) return null;
        const tight = lim.budget <= 0;
        return (
          <Pressable onPress={() => { animate(); setSubjectId(lim.s.id); setN(0); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: tight ? pal.dangerBg : pal.surfaceAlt, borderRadius: 12, padding: 12, marginBottom: 14, opacity: pressed ? 0.7 : 1 })}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: lim.s.color }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: tight ? pal.dangerText : pal.text, fontWeight: '700', fontSize: 13.5 }}>{lim.s.name} is tightest — {tight ? '0 skips left' : `${lim.budget} skip${lim.budget === 1 ? '' : 's'} left`}</Text>
              <Text style={{ color: tight ? pal.dangerText : pal.textSecondary, fontSize: 12, opacity: 0.9 }}>{tight ? "It's holding your overall down. Tap to focus on it." : 'Your limiting subject. Tap to focus on it.'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={tight ? pal.dangerText : pal.textMuted} />
          </Pressable>
        );
      })()}

      <Segment pal={pal} value={mode} options={[{ value: 'skip', label: 'Can I skip?' }, { value: 'attend', label: 'Must I attend?' }]} onChange={(v) => { setMode(v as any); setN(0); }} />

      <View style={{ backgroundColor: safe ? pal.brandSubtle : pal.dangerBg, borderRadius: 14, padding: 24, alignItems: 'center', marginTop: 16 }}>
        <Text style={{ color: safe ? pal.text : pal.dangerText, fontWeight: '800', fontSize: 34, letterSpacing: -0.8, textAlign: 'center' }}>{big}</Text>
        <Text style={{ color: safe ? pal.textSecondary : pal.dangerText, fontSize: 13.5, marginTop: 8, textAlign: 'center', lineHeight: 19 }}>{small}</Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 22, marginBottom: 4, paddingHorizontal: 2 }}>
        <Text style={{ color: pal.textSecondary, fontWeight: '600', fontSize: 13.5 }}>{mode === 'skip' ? 'If I skip…' : 'If I attend…'}</Text>
        <Text style={{ color: pal.text, fontWeight: '700', fontSize: 15 }}>{n}</Text>
      </View>
      <Slider style={{ width: '100%', height: 40 }} minimumValue={0} maximumValue={20} step={1} value={n} onValueChange={setN}
        minimumTrackTintColor={pal.brand} maximumTrackTintColor={pal.surfaceAlt} thumbTintColor={Platform.OS === 'android' ? pal.brand : undefined} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 4 }}>
        <Pressable onPress={() => setN(v => Math.max(0, v - 1))} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: pal.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Ionicons name="remove" size={20} color={pal.brand} /></Pressable>
        <Pressable onPress={() => setN(v => Math.min(20, v + 1))} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: pal.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Ionicons name="add" size={20} color={pal.brand} /></Pressable>
      </View>
      <Text style={{ color: pal.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 16 }}>Right now: {ah.h ? `${Math.round(currentPct(ah.a, ah.h))}%` : '—'} ({ah.a}/{ah.h}).</Text>

      <ProjectionCard pal={pal} data={data} subjectId={subjectId === 'all' ? null : subjectId} name={name} termEnd={data.settings.termEnd} />

      <Text style={{ color: pal.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 14, fontStyle: 'italic', opacity: 0.8, paddingHorizontal: 8 }}>Buffers are for real life — sick days, travel, bad days. Use it when you need it.</Text>
    </View>
  );
}
export function ProjectionCard({ pal, data, subjectId, name, termEnd }: { pal: Palette; data: AppData; subjectId: string | null; name: string; termEnd?: string }) {
  const box = { backgroundColor: pal.surface, borderRadius: 16, padding: 18, marginTop: 20 } as const;
  if (!termEnd) {
    return (
      <View style={[box, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
        <Ionicons name="calendar-outline" size={20} color={pal.textMuted} />
        <Text style={{ color: pal.textSecondary, fontSize: 13, flex: 1, lineHeight: 19 }}>Set your term dates in Settings to see where {name === 'overall' ? 'you' : name} will land by the end of term.</Text>
      </View>
    );
  }
  const p: Projection = project(data, subjectId, TODAY, termEnd);
  const T = data.settings.target;
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
