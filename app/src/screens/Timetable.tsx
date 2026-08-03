import React, { useState } from 'react';
import { View, Pressable, Modal } from 'react-native';
import { Text } from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../theme';
import { AppData, TODAY_DOW, uid, materializeToday } from '../logic';
import { WEEK, SetData, Title, Sub, Card, SectLabel } from '../components/ui';
import { CalendarHeatmap } from '../components/Charts';
import { SubjectForm, SlotForm } from '../components/forms';

export function Timetable({ pal, data, setData }: { pal: Palette; data: AppData; setData: SetData }) {
  const [day, setDay] = useState(TODAY_DOW === 0 ? 1 : TODAY_DOW);
  const [modal, setModal] = useState<{ kind: 'subject' | 'slot'; item?: any } | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const copyDayTo = (targets: number[]) => {
    const src = data.slots.filter(s => s.day === day && s.active);
    setData(d => {
      if (!d) return d;
      const clones = targets.flatMap(t => src.map(sl => ({ ...sl, id: uid(), day: t })));
      return materializeToday({ ...d, slots: [...d.slots, ...clones] });
    });
    setCopyOpen(false);
  };
  const activeSubIds = new Set(data.subjects.filter(s => s.active).map(s => s.id));
  const slots = data.slots.filter(s => s.day === day && s.active && activeSubIds.has(s.subjectId)).sort((a, b) => a.start.localeCompare(b.start));
  const addBtn = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: pal.surface, borderRadius: 14, padding: 15, marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name="add" size={18} color={pal.brand} /><Text style={{ color: pal.brand, fontWeight: '600', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
  return (
    <View>
      <Title pal={pal}>Timetable</Title>
      <Sub pal={pal}>Your weekly classes · {data.subjects.length} subjects</Sub>
      <View style={{ flexDirection: 'row', backgroundColor: pal.surfaceAlt, borderRadius: 9, padding: 2, marginBottom: 16 }}>
        {WEEK.map(d => {
          const on = d.v === day;
          return (
            <Pressable key={d.v} onPress={() => setDay(d.v)} style={({ pressed }) => ({ flex: 1, backgroundColor: on ? pal.surface : 'transparent', borderRadius: 7, paddingVertical: 8, alignItems: 'center', opacity: pressed && !on ? 0.6 : 1 })}>
              <Text style={{ color: pal.text, fontWeight: on ? '700' : '500', fontSize: 13 }}>{d.l[0]}</Text>
            </Pressable>
          );
        })}
      </View>
      {slots.length === 0 ? (
        <Text style={{ color: pal.textSecondary, textAlign: 'center', padding: 26 }}>No classes on {WEEK.find(w => w.v === day)?.l}.</Text>
      ) : slots.map(sl => {
        const sub = data.subjects.find(s => s.id === sl.subjectId);
        return (
          <Pressable key={sl.id} onPress={() => setModal({ kind: 'slot', item: sl })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pal.surface, borderRadius: 14, padding: 14, marginBottom: 10, opacity: pressed ? 0.6 : 1 })}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sub?.color ?? pal.neutral }} />
            <Text style={{ color: pal.textSecondary, fontWeight: '600', fontSize: 12.5, width: 100 }}>{sl.start}–{sl.end}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: pal.text, fontWeight: '600', fontSize: 15 }}>{sub?.name ?? 'Class'}</Text>
              <Text style={{ color: pal.textMuted, fontSize: 12.5 }}>{sl.room || 'No room'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={pal.textMuted} />
          </Pressable>
        );
      })}
      {addBtn('Add class', () => setModal({ kind: 'slot' }))}
      {addBtn('Add subject', () => setModal({ kind: 'subject' }))}
      {slots.length > 0 && (
        <Pressable onPress={() => setCopyOpen(true)} style={({ pressed }) => ({ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 13, marginTop: 4, opacity: pressed ? 0.6 : 1 })}>
          <Ionicons name="copy-outline" size={16} color={pal.brand} /><Text style={{ color: pal.brand, fontWeight: '600', fontSize: 14 }}>Copy {WEEK.find(w => w.v === day)?.l}'s classes to other days</Text>
        </Pressable>
      )}

      <SectLabel pal={pal}>Calendar</SectLabel>
      <Card pal={pal}><CalendarHeatmap pal={pal} data={data} /></Card>

      {modal?.kind === 'subject' && <SubjectForm pal={pal} data={data} setData={setData} editing={modal.item} onClose={() => setModal(null)} />}
      {modal?.kind === 'slot' && <SlotForm pal={pal} data={data} setData={setData} editing={modal.item} defaultDay={day} onClose={() => setModal(null)} />}
      {copyOpen && <CopyDayModal pal={pal} fromDay={day} onClose={() => setCopyOpen(false)} onCopy={copyDayTo} />}
    </View>
  );
}
function CopyDayModal({ pal, fromDay, onClose, onCopy }: { pal: Palette; fromDay: number; onClose: () => void; onCopy: (days: number[]) => void }) {
  const [sel, setSel] = useState<number[]>([]);
  const fromLabel = WEEK.find(w => w.v === fromDay)?.l;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxWidth: 480, alignSelf: 'center', width: '100%', backgroundColor: pal.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 }}>
        <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: pal.border, alignSelf: 'center', marginBottom: 14 }} />
        <Text style={{ color: pal.text, fontSize: 20, fontWeight: '800' }}>Copy {fromLabel}'s classes</Text>
        <Text style={{ color: pal.textSecondary, fontSize: 13.5, marginTop: 4, marginBottom: 14 }}>Pick the days to duplicate this day's classes onto.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {WEEK.filter(w => w.v !== fromDay).map(w => { const on = sel.includes(w.v); return <Pressable key={w.v} onPress={() => setSel(on ? sel.filter(x => x !== w.v) : [...sel, w.v])} style={{ backgroundColor: on ? pal.brand : pal.surfaceAlt, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}><Text style={{ color: on ? '#fff' : pal.text, fontWeight: '600', fontSize: 13 }}>{w.l}</Text></Pressable>; })}
        </View>
        <Pressable disabled={sel.length === 0} onPress={() => onCopy(sel)} style={({ pressed }) => ({ backgroundColor: sel.length ? pal.brand : pal.surfaceAlt, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 18, opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ color: sel.length ? '#fff' : pal.textMuted, fontWeight: '700', fontSize: 15 }}>Copy to {sel.length || 'selected'} {sel.length === 1 ? 'day' : 'days'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

