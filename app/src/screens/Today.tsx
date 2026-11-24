import React, { useState } from 'react';
import { View, Pressable, Animated, PanResponder, Modal, ActivityIndicator } from 'react-native';
import { Text } from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Rec, Status, Streak, haversine, maxBunksNow, statusOf, streaks, niceToday, overallCounts, subjectStats, TODAY, classesToReach, unmarkedPast } from '../logic';
import { Ring } from '../components/Ring';
import { Card, SectLabel, Title, Sub, Chip, SubjectBar, animate, niceDate } from '../components/ui';
import { SubjectPicker } from '../components/DaySheet';
import { FlameIcon } from '../components/FlameIcon';

export function Today({ pal, data, mark, setSubject, goTime }: any) {
  const t = overallCounts(data);
  const T = data.settings.target;
  const zone = statusOf(t.a, t.h, T);
  const skip = maxBunksNow(t.a, t.h, T);
  const stats = subjectStats(data);
  const activeSubIds = new Set(data.subjects.filter((s: any) => s.active).map((s: any) => s.id));
  const todays: Rec[] = data.records.filter((r: Rec) => r.date === TODAY && activeSubIds.has(r.subjectId)).sort((a: Rec, b: Rec) => a.scheduledStart.localeCompare(b.scheduledStart));
  const streak = streaks(data);

  let vBg = pal.brandSubtle, vFg = pal.text, vIcon: keyof typeof Ionicons.glyphMap = 'leaf', vTitle = 'Building your record', vSub = 'Mark a few more classes and your real numbers appear.';
  if (t.h >= 6) {
    if (zone === 'safe') { vBg = pal.safeBg; vFg = pal.safeText; vIcon = 'checkmark-circle'; vTitle = "You're safe"; vSub = `You can skip ${skip} more ${skip === 1 ? 'class' : 'classes'} and stay above ${T}%.`; }
    else if (zone === 'warn') { vBg = pal.warnBg; vFg = pal.warnText; vIcon = 'alert-circle'; vTitle = 'Cutting it close'; vSub = `You can skip ${skip} more. A couple of classes builds a cushion.`; }
    else { const need = classesToReach(t.a, t.h, T); vBg = pal.dangerBg; vFg = pal.dangerText; vIcon = 'close-circle'; vTitle = `Below ${T}%`; vSub = need == null ? `Can't reach ${T}% this term.` : `Attend the next ${need} ${need === 1 ? 'class' : 'classes'} to get back to safe.`; }
  }

  return (
    <View>
      <Title pal={pal}>Today</Title>
      <Sub pal={pal}>{niceToday()} · {todays.length} {todays.length === 1 ? 'class' : 'classes'}</Sub>

      <CatchUpCard pal={pal} data={data} mark={mark} setSubject={setSubject} />

      <View style={{ flexDirection: 'row', gap: 12, backgroundColor: vBg, borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <Ionicons name={vIcon} size={22} color={vFg} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: vFg, fontWeight: '700', fontSize: 16 }}>{vTitle}</Text>
          <Text style={{ color: vFg, fontSize: 13.5, marginTop: 3, opacity: 0.95 }}>{vSub}</Text>
        </View>
      </View>

      <Card pal={pal}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Ring a={t.a} h={t.h} target={T} pal={pal} rounding={data.settings.roundingRule} />
          <View style={{ flex: 1 }}>
            <Chip pal={pal} zone={zone} />
            <Text style={{ color: pal.textSecondary, fontSize: 12.5, marginTop: 8, lineHeight: 18 }}>
              {t.h ? `${t.a} of ${t.h} classes attended${zone === 'safe' || zone === 'warn' ? ` · buffer of ${skip}` : ''}.` : 'Mark your first class to begin.'}
            </Text>
          </View>
        </View>
      </Card>

      {t.h >= 6 && (
        <StreakCard pal={pal} s={streak} />
      )}

      <SectLabel pal={pal}>Today's classes</SectLabel>
      <Card pal={pal} style={{ paddingVertical: 4 }}>
        {todays.length === 0 ? (
          <Text style={{ color: pal.textSecondary, textAlign: 'center', paddingVertical: 14, fontWeight: '500' }}>No classes today — enjoy the break.</Text>
        ) : todays.map((r, i) => <ClassRow key={r.id} pal={pal} data={data} r={r} mark={mark} setSubject={setSubject} last={i === todays.length - 1} />)}
      </Card>

      <View style={{ height: 18 }} />
      {stats.length === 0
        ? <Pressable onPress={goTime}><Text style={{ color: pal.brand, textAlign: 'center', padding: 20, fontWeight: '600' }}>Set up your timetable →</Text></Pressable>
        : stats.map((x: any) => <SubjectBar key={x.s.id} pal={pal} x={x} target={x.target} rounding={data.settings.roundingRule} />)}
    </View>
  );
}

/** Continuous class streak: gradient flame when lit, and a plain sentence. */
function StreakCard({ pal, s }: { pal: any; s: Streak }) {
  const lit = s.current > 0;
  const plural = (n: number) => `${n} ${n === 1 ? 'class' : 'classes'}`;
  const title = s.paused ? 'Streak paused'
    : lit ? `${plural(s.current)} in a row`
    : 'Start a new streak';
  const sub = s.paused
    ? `${s.pausedAt ? `You were on ${s.pausedAt}. ` : ''}Mark ${plural(s.paused)} you missed above to continue.`
    : lit ? (s.current >= s.best ? `Your best run yet. Keep it going at your next class.` : `Best: ${s.best}. Keep it going at your next class.`)
    : `Check in to your next class to begin.${s.best ? ` Best: ${s.best}` : ''}`;
  return (
    <Card pal={pal}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {lit ? <FlameIcon size={28} /> : <Ionicons name="flame-outline" size={26} color={pal.textMuted} />}
        <View style={{ flex: 1 }}>
          <Text style={{ color: pal.text, fontWeight: '700', fontSize: 15 }}>{title}</Text>
          <Text style={{ color: pal.textSecondary, fontSize: 12.5, marginTop: 1 }}>{sub}</Text>
        </View>
      </View>
    </Card>
  );
}

function CatchUpCard({ pal, data, mark, setSubject }: any) {
  const items: Rec[] = unmarkedPast(data);
  const [open, setOpen] = useState(false);
  const [swap, setSwap] = useState<Rec | null>(null);
  if (items.length === 0) return null;
  const chip = (bg: string, fg: string, icon: any, onPress: () => void) => (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={icon} size={17} color={fg} />
    </Pressable>
  );
  return (
    <View style={{ backgroundColor: pal.warnBg, borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <Pressable onPress={() => { animate(); setOpen(o => !o); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="time" size={20} color={pal.warnText} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: pal.warnText, fontWeight: '700', fontSize: 15 }}>{items.length} {items.length === 1 ? 'class' : 'classes'} to catch up</Text>
          <Text style={{ color: pal.warnText, fontSize: 12.5, opacity: 0.9 }}>You didn't mark these — set them so your % stays honest.</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={pal.warnText} />
      </Pressable>
      {open && (
        <View style={{ marginTop: 12, gap: 8 }}>
          {items.slice(0, 30).map((r) => {
            const sub = data.subjects.find((s: any) => s.id === r.subjectId);
            return (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: pal.surface, borderRadius: 10, paddingLeft: 12, paddingRight: 8, paddingVertical: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: pal.text, fontWeight: '600', fontSize: 13.5 }} numberOfLines={1}>{sub?.name ?? 'Class'}</Text>
                  <Text style={{ color: pal.textMuted, fontSize: 11.5 }}>{niceDate(r.date)} · {r.scheduledStart}</Text>
                </View>
                {chip(pal.safeBg, pal.safeText, 'checkmark', () => mark(r.id, 'present'))}
                {chip(pal.dangerBg, pal.dangerText, 'close', () => mark(r.id, 'absent'))}
                {chip(pal.neutralBg, pal.neutralText, 'remove', () => mark(r.id, 'cancelled'))}
                {chip(pal.surfaceAlt, pal.brand, 'swap-horizontal', () => setSwap(r))}
              </View>
            );
          })}
          {items.length > 30 && <Text style={{ color: pal.warnText, fontSize: 12, textAlign: 'center' }}>+{items.length - 30} more — mark the ones above first.</Text>}
        </View>
      )}
      {swap && <SubjectPicker pal={pal} data={data} rec={swap} onClose={() => setSwap(null)} onPick={(id: string) => { setSubject(swap.id, id); setSwap(null); }} />}
    </View>
  );
}

export function ClassRow({ pal, data, r, mark, setSubject, last }: any) {
  const sub = data.subjects.find((s: any) => s.id === r.subjectId);
  const slot = data.slots.find((s: any) => s.id === r.slotId);
  const [menu, setMenu] = useState(false);
  const [checking, setChecking] = useState(false);
  const [ckPrompt, setCkPrompt] = useState<any>(null);
  const [swap, setSwap] = useState(false);
  const plannedName = r.plannedSubjectId && r.plannedSubjectId !== r.subjectId ? (data.subjects.find((s: any) => s.id === r.plannedSubjectId)?.name ?? 'a deleted subject') : null;
  async function doCheckIn() {
    if (!slot || slot.lat == null) { setCkPrompt({ kind: 'noloc' }); return; }
    setChecking(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setChecking(false); setCkPrompt({ kind: 'denied' }); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setChecking(false);
      const dist = haversine(pos.coords.latitude, pos.coords.longitude, slot.lat, slot.lng);
      const acc = pos.coords.accuracy ?? 100;
      if (dist <= (slot.radius || 100) + acc) {
        const now = new Date();
        const [sh, sm] = (slot.start || '00:00').split(':').map(Number);
        const grace = data.settings.graceMin ?? 15;
        const late = now.getHours() * 60 + now.getMinutes() > sh * 60 + sm + grace;   // past the grace window
        mark(r.id, late ? 'late' : 'present');
      }
      else setCkPrompt({ kind: 'far', dist: Math.round(dist), room: slot.room });
    } catch { setChecking(false); setCkPrompt({ kind: 'error' }); }
  }
  const tx = React.useRef(new Animated.Value(0)).current;
  const markRef = React.useRef(mark); markRef.current = mark;
  const idRef = React.useRef(r.id); idRef.current = r.id;
  const pan = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderMove: (_e, g) => tx.setValue(Math.max(-140, Math.min(140, g.dx))),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > 80) markRef.current(idRef.current, 'present');
        else if (g.dx < -80) markRef.current(idRef.current, 'absent');
        Animated.spring(tx, { toValue: 0, useNativeDriver: false, speed: 18, bounciness: 6 }).start();
      },
      onPanResponderTerminate: () => { Animated.spring(tx, { toValue: 0, useNativeDriver: false }).start(); },
    })
  ).current;

  let right;
  if (r.status === 'present') right = (
    <Pressable onPress={() => mark(r.id, 'pending')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: pal.safeBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name="checkmark" size={14} color={pal.safeText} /><Text style={{ color: pal.safeText, fontWeight: '700', fontSize: 13 }}>Present</Text>
    </Pressable>
  );
  else if (r.status === 'late') right = <Pressable onPress={() => mark(r.id, 'pending')}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: pal.warnBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}><Ionicons name="time" size={14} color={pal.warnText} /><Text style={{ color: pal.warnText, fontWeight: '700', fontSize: 13 }}>Late</Text></View></Pressable>;
  else if (r.status === 'absent') right = <Pressable onPress={() => mark(r.id, 'pending')}><Chip pal={pal} zone="danger" /></Pressable>;
  else if (r.status === 'cancelled') right = <Pressable onPress={() => mark(r.id, 'pending')}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: pal.neutralBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Ionicons name="remove-circle" size={13} color={pal.neutralText} /><Text style={{ color: pal.neutralText, fontWeight: '600', fontSize: 12.5 }}>No class</Text></View></Pressable>;
  else if (r.status === 'holiday') right = <Pressable onPress={() => mark(r.id, 'pending')}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: pal.neutralBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Ionicons name="sunny" size={13} color={pal.neutralText} /><Text style={{ color: pal.neutralText, fontWeight: '600', fontSize: 12.5 }}>Holiday</Text></View></Pressable>;
  else right = (
    <Pressable onPress={doCheckIn} disabled={checking} style={({ pressed }) => ({ backgroundColor: pal.brand, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, minWidth: 108, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', opacity: pressed || checking ? 0.7 : 1 })}>
      {checking
        ? <ActivityIndicator size="small" color="#fff" />
        : <><Ionicons name="location" size={15} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Check in</Text></>}
    </Pressable>
  );

  return (
    <View style={{ borderBottomWidth: last ? 0 : 0.5, borderBottomColor: pal.hair, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
        <View style={{ flex: 1, backgroundColor: pal.safe, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, gap: 6 }}>
          <Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Present</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: pal.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16, gap: 6 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Absent</Text><Ionicons name="close-circle" size={18} color="#fff" />
        </View>
      </View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: tx }], backgroundColor: pal.surface, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, userSelect: 'none' } as any}>
        <Text style={{ color: pal.textSecondary, fontWeight: '600', fontSize: 13, width: 48 }}>{r.scheduledStart}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: pal.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{sub?.name ?? 'Class'}</Text>
          <Text style={{ color: pal.textMuted, fontSize: 12.5 }} numberOfLines={1}>{plannedName ? `Instead of ${plannedName}` : (slot?.room || 'No room')}</Text>
        </View>
        {right}
        <Pressable onPress={() => setMenu(true)} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, paddingHorizontal: 2 })}><Ionicons name="ellipsis-horizontal" size={18} color={pal.textMuted} /></Pressable>
      </Animated.View>
      {menu && <RowMenu pal={pal} name={sub?.name} onSwap={() => { setMenu(false); setSwap(true); }} onPick={(st: Status) => { setMenu(false); mark(r.id, st); }} onClose={() => setMenu(false)} />}
      {swap && <SubjectPicker pal={pal} data={data} rec={r} onClose={() => setSwap(false)} onPick={(id: string) => { setSubject(r.id, id); setSwap(false); }} />}
      {ckPrompt && <CheckinPrompt pal={pal} prompt={ckPrompt} onPick={(st: Status) => { setCkPrompt(null); mark(r.id, st); }} onClose={() => setCkPrompt(null)} />}
    </View>
  );
}
export function CheckinPrompt({ pal, prompt, onPick, onClose }: any) {
  let title = "Couldn't get GPS", body = 'No clear location fix right now. Mark it by hand?';
  if (prompt.kind === 'far') { title = `You seem ~${prompt.dist}m away`; body = `That's outside ${prompt.room || 'this class'}. Mark present anyway, or absent?`; }
  else if (prompt.kind === 'denied') { title = 'Location is off'; body = 'Location permission was denied. You can still mark by hand — everything works without GPS.'; }
  else if (prompt.kind === 'noloc') { title = 'No location set'; body = 'This class has no saved location yet. Set it on the map (edit the class in Timetable), or just mark present now.'; }
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxWidth: 480, alignSelf: 'center', width: '100%', backgroundColor: pal.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 }}>
        <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: pal.border, alignSelf: 'center', marginBottom: 14 }} />
        <Text style={{ color: pal.text, fontSize: 19, fontWeight: '800', marginBottom: 6 }}>{title}</Text>
        <Text style={{ color: pal.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>{body}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => onPick('present')} style={({ pressed }) => ({ flex: 1, backgroundColor: pal.brand, borderRadius: 12, paddingVertical: 15, alignItems: 'center', opacity: pressed ? 0.85 : 1 })}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Mark present</Text></Pressable>
          <Pressable onPress={() => onPick('absent')} style={({ pressed }) => ({ backgroundColor: pal.surfaceAlt, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}><Text style={{ color: pal.danger, fontWeight: '700', fontSize: 15 }}>Absent</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}
export function RowMenu({ pal, name, onPick, onSwap, onClose }: any) {
  const opt = (icon: any, color: string, label: string, note: string | null, st: Status) => (
    <Pressable onPress={() => onPick(st)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: pal.hair, opacity: pressed ? 0.5 : 1 })}>
      <Ionicons name={icon} size={20} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: pal.text, fontSize: 15, fontWeight: '500' }}>{label}</Text>
        {note ? <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 1 }}>{note}</Text> : null}
      </View>
    </Pressable>
  );
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxWidth: 480, alignSelf: 'center', width: '100%', backgroundColor: pal.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 }}>
        <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: pal.border, alignSelf: 'center', marginBottom: 14 }} />
        <Text style={{ color: pal.text, fontSize: 18, fontWeight: '800', marginBottom: 6 }}>{name ?? 'Class'}</Text>
        {opt('checkmark-circle', pal.safe, 'Present', null, 'present')}
        {opt('time', pal.warn, 'Late', 'Attended after the grace window — still counts as present', 'late')}
        {opt('close-circle', pal.danger, 'Absent', null, 'absent')}
        {opt('remove-circle', pal.neutral, 'No class held', "Cancelled — doesn't count toward your %", 'cancelled')}
        {opt('sunny', pal.neutral, 'Holiday / day off', "Doesn't count toward your %", 'holiday')}
        {opt('refresh', pal.textSecondary, 'Clear', null, 'pending')}
        {onSwap && (
          <Pressable onPress={onSwap} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, opacity: pressed ? 0.5 : 1 })}>
            <Ionicons name="swap-horizontal" size={20} color={pal.brand} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: pal.text, fontSize: 15, fontWeight: '500' }}>Change subject</Text>
              <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 1 }}>Another class ran in this slot. The timetabled one stays frozen.</Text>
            </View>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

/* ---------------- Stats ---------------- */
