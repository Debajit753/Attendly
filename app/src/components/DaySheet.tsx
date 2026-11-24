import React, { useState } from 'react';
import { View, Pressable, ScrollView, Modal } from 'react-native';
import { Text } from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../theme';
import {
  AppData, Rec, Status, TODAY, parseISO, recordsOn, plannedSlotsOn, ensureDayRecords,
  setRecordStatus, markDayHoliday, changeRecSubject, addExtraClass,
} from '../logic';
import type { SetData } from './ui';
import { TimeField } from './TimePicker';

/* Bottom sheet for one calendar date: mark each class, swap a class to another
   subject, add an extra class, or mark the whole day as a holiday. */

const STATUS_OPTS: { st: Status; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { st: 'present', label: 'Present', icon: 'checkmark' },
  { st: 'late', label: 'Late', icon: 'time' },
  { st: 'absent', label: 'Absent', icon: 'close' },
  { st: 'cancelled', label: 'Not held', icon: 'remove' },
];

function statusColors(pal: Palette, st: Status) {
  if (st === 'present') return { bg: pal.safeBg, fg: pal.safeText };
  if (st === 'late') return { bg: pal.warnBg, fg: pal.warnText };
  if (st === 'absent') return { bg: pal.dangerBg, fg: pal.dangerText };
  return { bg: pal.neutralBg, fg: pal.neutralText };
}

const sheetBox = (pal: Palette) => ({ position: 'absolute' as const, left: 0, right: 0, bottom: 0, maxWidth: 480, alignSelf: 'center' as const, width: '100%' as const, maxHeight: '88%' as const, backgroundColor: pal.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 });
const grabber = (pal: Palette) => <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: pal.border, alignSelf: 'center', marginBottom: 12 }} />;

/** List of subjects to pick from (used inline in the day sheet and as its own modal on Today). */
function SubjectList({ pal, data, current, planned, onPick }: { pal: Palette; data: AppData; current?: string; planned?: string; onPick: (id: string) => void }) {
  return (
    <View style={{ gap: 8 }}>
      {data.subjects.filter(s => s.active).map(s => {
        const on = s.id === current;
        return (
          <Pressable key={s.id} onPress={() => onPick(s.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: on ? pal.brandSubtle : pal.surfaceAlt, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
            <Text style={{ color: pal.text, fontSize: 15, fontWeight: on ? '700' : '500', flex: 1 }} numberOfLines={2}>{s.name}</Text>
            {s.id === planned && <Text style={{ color: pal.textMuted, fontSize: 12 }}>timetable</Text>}
            {on && <Ionicons name="checkmark-circle" size={18} color={pal.brand} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const freezeNote = 'The timetabled subject is frozen for this class: it is not counted as held or absent.';

/** Stand-alone "change subject" sheet, opened from a class row on Today. */
export function SubjectPicker({ pal, data, rec, onPick, onClose }: { pal: Palette; data: AppData; rec: Rec; onPick: (subjectId: string) => void; onClose: () => void }) {
  const planned = rec.plannedSubjectId ?? rec.subjectId;
  const plannedName = data.subjects.find(s => s.id === planned)?.name ?? 'the timetabled subject';
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={sheetBox(pal)}>
        {grabber(pal)}
        <Text style={{ color: pal.text, fontSize: 19, fontWeight: '800' }}>Which class actually happened?</Text>
        <Text style={{ color: pal.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 14 }}>Timetable says {plannedName} at {rec.scheduledStart}. {freezeNote}</Text>
        <ScrollView>
          <SubjectList pal={pal} data={data} current={rec.subjectId} planned={planned} onPick={onPick} />
        </ScrollView>
      </View>
    </Modal>
  );
}

export function DaySheet({ pal, data, setData, iso, onClose }: { pal: Palette; data: AppData; setData: SetData; iso: string; onClose: () => void }) {
  const isFuture = iso > TODAY;
  // Opening a past/today date fills in its timetable classes as "pending" so they can be marked.
  React.useEffect(() => { if (!isFuture) setData(d => (d ? ensureDayRecords(d, iso) : d)); }, [iso]);
  const [picking, setPicking] = useState<string | null>(null);   // rec id being swapped, or 'extra'
  const [extraSub, setExtraSub] = useState<string | null>(null);
  const [extraTime, setExtraTime] = useState('10:00');

  const title = parseISO(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const subName = (id?: string) => data.subjects.find(s => s.id === id)?.name;
  const recs = recordsOn(data, iso);
  const planned = isFuture ? plannedSlotsOn(data, iso) : [];
  const upd = (f: (d: AppData) => AppData) => setData(d => (d ? f(d) : d));

  const pickingRec = picking && picking !== 'extra' ? recs.find(r => r.id === picking) : undefined;

  let body: React.ReactNode;
  if (pickingRec) {
    const plannedId = pickingRec.plannedSubjectId ?? pickingRec.subjectId;
    body = (
      <>
        <Text style={{ color: pal.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>Timetable says {subName(plannedId) ?? 'this subject'} at {pickingRec.scheduledStart}. Pick the class that actually ran. {freezeNote}</Text>
        <SubjectList pal={pal} data={data} current={pickingRec.subjectId} planned={plannedId} onPick={(id) => { upd(d => changeRecSubject(d, pickingRec.id, id)); setPicking(null); }} />
        <Pressable onPress={() => setPicking(null)} style={{ alignItems: 'center', paddingVertical: 14 }}><Text style={{ color: pal.textSecondary, fontWeight: '600' }}>Cancel</Text></Pressable>
      </>
    );
  } else if (picking === 'extra') {
    body = (
      <>
        <Text style={{ color: pal.textSecondary, fontSize: 13, marginBottom: 12 }}>An extra or makeup class that isn't in your timetable.</Text>
        <SubjectList pal={pal} data={data} current={extraSub ?? undefined} onPick={setExtraSub} />
        <Text style={{ color: pal.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 }}>Start time</Text>
        <TimeField pal={pal} value={extraTime} onChange={setExtraTime} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Pressable disabled={!extraSub} onPress={() => { if (extraSub) upd(d => addExtraClass(d, iso, extraSub, extraTime, 'pending')); setPicking(null); setExtraSub(null); }}
            style={({ pressed }) => ({ flex: 1, backgroundColor: extraSub ? pal.brand : pal.surfaceAlt, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.85 : 1 })}>
            <Text style={{ color: extraSub ? '#fff' : pal.textMuted, fontWeight: '700' }}>Add class</Text>
          </Pressable>
          <Pressable onPress={() => { setPicking(null); setExtraSub(null); }} style={{ paddingHorizontal: 18, justifyContent: 'center' }}><Text style={{ color: pal.textSecondary, fontWeight: '600' }}>Cancel</Text></Pressable>
        </View>
      </>
    );
  } else if (isFuture) {
    body = planned.length === 0
      ? <Text style={{ color: pal.textSecondary, paddingVertical: 12 }}>No classes in your timetable on this day.</Text>
      : (
        <>
          <Text style={{ color: pal.textMuted, fontSize: 12.5, marginBottom: 8 }}>Planned from your timetable. You can mark these on the day.</Text>
          {planned.map(sl => (
            <View key={sl.id} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: pal.hair }}>
              <Text style={{ color: pal.textSecondary, fontWeight: '600', width: 48 }}>{sl.start}</Text>
              <Text style={{ color: pal.text, fontWeight: '600', flex: 1 }} numberOfLines={2}>{subName(sl.subjectId) ?? 'Class'}</Text>
            </View>
          ))}
        </>
      );
  } else {
    body = (
      <>
        {recs.length === 0 && <Text style={{ color: pal.textSecondary, paddingVertical: 12 }}>No classes recorded on this day.</Text>}
        {recs.map(r => {
          const swapped = r.plannedSubjectId && r.plannedSubjectId !== r.subjectId;
          return (
            <View key={r.id} style={{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: pal.hair }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <Text style={{ color: pal.textSecondary, fontWeight: '600', width: 48, marginTop: 1 }}>{r.scheduledStart}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: pal.text, fontWeight: '700', fontSize: 15 }} numberOfLines={2}>{subName(r.subjectId) ?? 'Class'}</Text>
                  {swapped && <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 1 }} numberOfLines={2}>Instead of {subName(r.plannedSubjectId) ?? 'a deleted subject'} (frozen, not counted)</Text>}
                  {r.status === 'holiday' && <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 1 }}>Holiday, not counted</Text>}
                </View>
                <Pressable onPress={() => setPicking(r.id)} hitSlop={6} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.5 : 1 })}>
                  <Ionicons name="swap-horizontal" size={15} color={pal.brand} />
                  <Text style={{ color: pal.brand, fontWeight: '600', fontSize: 13 }}>Change</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, marginLeft: 60, flexWrap: 'wrap' }}>
                {STATUS_OPTS.map(o => {
                  const on = r.status === o.st;
                  const c = statusColors(pal, o.st);
                  return (
                    <Pressable key={o.st} onPress={() => upd(d => setRecordStatus(d, r.id, on ? 'pending' : o.st))}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: on ? c.bg : pal.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: on ? 1 : 0, borderColor: c.fg, opacity: pressed ? 0.6 : 1 })}>
                      <Ionicons name={o.icon} size={12} color={on ? c.fg : pal.textSecondary} />
                      <Text style={{ color: on ? c.fg : pal.textSecondary, fontSize: 12.5, fontWeight: on ? '700' : '500' }}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Pressable onPress={() => setPicking('extra')} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: pal.surfaceAlt, borderRadius: 12, paddingVertical: 13, opacity: pressed ? 0.6 : 1 })}>
            <Ionicons name="add" size={17} color={pal.brand} /><Text style={{ color: pal.brand, fontWeight: '600' }}>Extra class</Text>
          </Pressable>
          {recs.length > 0 && (
            <Pressable onPress={() => upd(d => markDayHoliday(d, iso))} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: pal.surfaceAlt, borderRadius: 12, paddingVertical: 13, opacity: pressed ? 0.6 : 1 })}>
              <Ionicons name="sunny-outline" size={16} color={pal.textSecondary} /><Text style={{ color: pal.textSecondary, fontWeight: '600' }}>Whole day holiday</Text>
            </Pressable>
          )}
        </View>
      </>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={sheetBox(pal)}>
        {grabber(pal)}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ color: pal.text, fontSize: 19, fontWeight: '800', flex: 1 }}>{picking === 'extra' ? 'Add extra class' : pickingRec ? 'Change class' : title}</Text>
          <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color={pal.textMuted} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">{body}</ScrollView>
      </View>
    </Modal>
  );
}
