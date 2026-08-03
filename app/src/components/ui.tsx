import React from 'react';
import { View, Pressable, LayoutAnimation } from 'react-native';
import { Text } from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../theme';
import { Zone, AppData, RoundingRule, classesToReach, parseISO, roundP } from '../logic';

/* Shared UI primitives + small helpers used across screens. */
export const animate = () => LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
export const ZONE_ICON: Record<Zone, keyof typeof Ionicons.glyphMap> = {
  safe: 'checkmark-circle', warn: 'alert-circle', danger: 'close-circle', building: 'leaf', neutral: 'remove-circle',
};
export const ZONE_WORD: Record<Zone, string> = { safe: 'Safe', warn: 'Cutting it close', danger: 'Needs attention', building: 'Building', neutral: 'Not counted' };
export function Chip({ pal, zone }: { pal: Palette; zone: Zone }) {
  const bg = zone === 'safe' ? pal.safeBg : zone === 'warn' ? pal.warnBg : zone === 'danger' ? pal.dangerBg : pal.neutralBg;
  const fg = zone === 'safe' ? pal.safeText : zone === 'warn' ? pal.warnText : zone === 'danger' ? pal.dangerText : pal.neutralText;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Ionicons name={ZONE_ICON[zone]} size={13} color={fg} />
      <Text style={{ color: fg, fontWeight: '600', fontSize: 12.5 }}>{ZONE_WORD[zone]}</Text>
    </View>
  );
}
export function Card({ pal, children, style }: any) {
  return <View style={[{ backgroundColor: pal.surface, borderRadius: 14, padding: 16, marginBottom: 14 }, style]}>{children}</View>;
}
export function SectLabel({ pal, children, right }: any) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8, paddingHorizontal: 4 }}>
      <Text style={{ color: pal.textMuted, fontWeight: '600', fontSize: 12.5 }}>{children}</Text>
      {right}
    </View>
  );
}
export const Title = ({ pal, children }: any) => <Text style={{ color: pal.text, fontWeight: '800', fontSize: 22, letterSpacing: -0.4, marginBottom: 1 }}>{children}</Text>;
export const Sub = ({ pal, children }: any) => <Text style={{ color: pal.textSecondary, fontSize: 12.5, marginBottom: 8 }}>{children}</Text>;

export function SubjectBar({ pal, x, target, rounding }: { pal: Palette; x: any; target: number; rounding?: RoundingRule }) {
  const fill = x.zone === 'danger' ? pal.danger : x.zone === 'warn' ? pal.warn : x.zone === 'building' ? pal.neutral : pal.safe;
  const recover = x.zone === 'danger' && x.h >= 6 ? ` · attend ${classesToReach(x.a, x.h, target) ?? '—'} to recover` : '';
  return (
    <View style={{ marginBottom: 15 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: x.s.color }} />
          <Text style={{ color: pal.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{x.s.name}</Text>
          <Chip pal={pal} zone={x.zone} />
        </View>
        <Text style={{ color: pal.text, fontWeight: '700', fontSize: 15 }}>{x.h ? `${roundP(x.pct, rounding)}%` : '—'}</Text>
      </View>
      <View style={{ height: 10, backgroundColor: pal.surfaceAlt, borderRadius: 999, justifyContent: 'center' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(x.pct, 100)}%`, backgroundColor: fill, borderRadius: 999 }} />
        <View style={{ position: 'absolute', left: `${target}%`, top: -3, bottom: -3, width: 2, backgroundColor: pal.text, opacity: 0.3, borderRadius: 2 }} />
      </View>
      <Text style={{ color: pal.textMuted, fontSize: 11.5, fontWeight: '500', marginTop: 6 }}>{x.a}/{x.h} classes{recover}</Text>
    </View>
  );
}
export const niceDate = (iso: string) => { try { return parseISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; } };
export function Segment({ pal, value, options, onChange }: { pal: Palette; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: pal.surfaceAlt, borderRadius: 9, padding: 2 }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => { animate(); onChange(o.value); }} style={({ pressed }) => ({ flex: 1, backgroundColor: on ? pal.surface : 'transparent', borderRadius: 7, paddingVertical: 8, alignItems: 'center', opacity: pressed && !on ? 0.6 : 1 })}>
            <Text style={{ color: pal.text, fontWeight: on ? '700' : '500', fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------------- Timetable ---------------- */
export const WEEK = [{ v: 1, l: 'Mon' }, { v: 2, l: 'Tue' }, { v: 3, l: 'Wed' }, { v: 4, l: 'Thu' }, { v: 5, l: 'Fri' }, { v: 6, l: 'Sat' }, { v: 0, l: 'Sun' }];
export type SetData = (u: (d: AppData | null) => AppData | null) => void;
export const inputStyle = (pal: Palette) => ({ backgroundColor: pal.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: pal.text });
export function Field({ pal, label, children, style }: any) {
  return <View style={[{ marginBottom: 14 }, style]}><Text style={{ color: pal.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>{label}</Text>{children}</View>;
}
export function Stepper({ pal, icon, onPress }: any) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, backgroundColor: pal.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
      <Ionicons name={icon} size={18} color={pal.brand} />
    </Pressable>
  );
}

/* ---------------- Onboarding ---------------- */
