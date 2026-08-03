import React, { useState } from 'react';
import { View, Pressable, ScrollView, Modal } from 'react-native';
import { Text, TextInput } from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { Palette, SUBJECT_COLORS } from '../theme';
import { AppData, uid, materializeToday, parseISO, isoDate } from '../logic';
import { Field, inputStyle, WEEK, niceDate, Stepper } from './ui';
import { TimeField } from './TimePicker';
import { MapPicker } from './MapPicker';

/* Bottom-sheet forms: date row, subject + class editors. */
export function DateRow({ pal, label, hint, value, onChange, last }: { pal: Palette; label: string; hint?: string; value?: string; onChange: (v: string | undefined) => void; last?: boolean }) {
  const [text, setText] = React.useState(value ?? '');
  React.useEffect(() => { setText(value ?? ''); }, [value]);
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  const parsedOk = (t: string) => { if (!isoRe.test(t)) return false; const d = parseISO(t); return !isNaN(d.getTime()) && isoDate(d) === t; };
  const valid = parsedOk(text);
  const invalid = text.length > 0 && !valid;
  const commit = (t: string) => { setText(t); if (t === '') onChange(undefined); else if (parsedOk(t)) onChange(t); };
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: pal.hair }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: pal.text, fontSize: 15 }}>{label}</Text>
          <Text style={{ color: invalid ? pal.danger : pal.textMuted, fontSize: 12, marginTop: 2 }}>{valid ? niceDate(text) : invalid ? 'Use format YYYY-MM-DD' : (hint || 'YYYY-MM-DD')}</Text>
        </View>
        <TextInput value={text} onChangeText={commit} placeholder="2026-12-15" placeholderTextColor={pal.textMuted} autoCapitalize="none" autoCorrect={false}
          style={{ color: pal.text, fontSize: 15, fontWeight: '600', backgroundColor: pal.surfaceAlt, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, width: 138, textAlign: 'center' }} />
      </View>
    </View>
  );
}
export function FormModal({ pal, title, children, onClose, onSave, onDelete }: any) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxWidth: 480, alignSelf: 'center', width: '100%', backgroundColor: pal.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34, maxHeight: '90%' }}>
        <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: pal.border, alignSelf: 'center', marginBottom: 14 }} />
        <Text style={{ color: pal.text, fontSize: 20, fontWeight: '800', marginBottom: 16 }}>{title}</Text>
        <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        {onSave && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable onPress={onSave} style={({ pressed }) => ({ flex: 1, backgroundColor: pal.brand, borderRadius: 12, paddingVertical: 15, alignItems: 'center', opacity: pressed ? 0.85 : 1 })}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save</Text></Pressable>
            {onDelete && <Pressable onPress={onDelete} style={({ pressed }) => ({ backgroundColor: pal.surfaceAlt, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}><Text style={{ color: pal.danger, fontWeight: '700', fontSize: 15 }}>Delete</Text></Pressable>}
          </View>
        )}
      </View>
    </Modal>
  );
}
export function SubjectForm({ pal, data, setData, editing, onClose }: any) {
  const [name, setName] = useState(editing?.name ?? '');
  const [color, setColor] = useState(editing?.color ?? SUBJECT_COLORS[data.subjects.length % SUBJECT_COLORS.length]);
  const [target, setTarget] = useState<number | undefined>(editing?.target);
  const busy = React.useRef(false);
  const save = () => {
    if (busy.current || !name.trim()) return;   // guard against double-tap
    busy.current = true;
    const clean = name.trim();
    setData((d: AppData | null) => {
      if (!d) return d;
      if (editing) return { ...d, subjects: d.subjects.map(s => (s.id === editing.id ? { ...s, name: clean, color, target } : s)) };
      if (d.subjects.some(s => s.name.trim().toLowerCase() === clean.toLowerCase())) return d; // no duplicate name
      return { ...d, subjects: [...d.subjects, { id: uid(), name: clean, color, active: true, target }] };
    });
    onClose();
  };
  const del = () => {
    setData((d: AppData | null) => (d ? { ...d, subjects: d.subjects.filter(s => s.id !== editing.id), slots: d.slots.filter(s => s.subjectId !== editing.id), records: d.records.filter(r => r.subjectId !== editing.id) } : d));
    onClose();
  };
  return (
    <FormModal pal={pal} title={editing ? 'Edit subject' : 'Add subject'} onClose={onClose} onSave={save} onDelete={editing ? del : undefined}>
      <Field pal={pal} label="Subject name"><TextInput value={name} onChangeText={setName} placeholder="e.g. Data Structures" placeholderTextColor={pal.textMuted} style={inputStyle(pal)} /></Field>
      <Field pal={pal} label="Colour"><View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>{SUBJECT_COLORS.map(c => <Pressable key={c} onPress={() => setColor(c)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: 3, borderColor: c === color ? pal.text : 'transparent' }} />)}</View></Field>
      <Field pal={pal} label="Attendance target">
        {target == null ? (
          <Pressable onPress={() => setTarget(data.settings.target)} style={({ pressed }) => ({ backgroundColor: pal.surfaceAlt, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: pal.textSecondary, fontSize: 14 }}>Using the overall default ({data.settings.target}%) · <Text style={{ color: pal.brand, fontWeight: '600' }}>set a custom target</Text></Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Stepper pal={pal} icon="remove" onPress={() => setTarget(Math.max(1, target - 1))} />
            <Text style={{ color: pal.text, fontWeight: '700', fontSize: 17, minWidth: 48, textAlign: 'center' }}>{target}%</Text>
            <Stepper pal={pal} icon="add" onPress={() => setTarget(Math.min(100, target + 1))} />
            <Pressable onPress={() => setTarget(undefined)} hitSlop={6} style={{ marginLeft: 'auto' }}><Text style={{ color: pal.brand, fontWeight: '600', fontSize: 13 }}>Use default</Text></Pressable>
          </View>
        )}
      </Field>
    </FormModal>
  );
}
export function SlotForm({ pal, data, setData, editing, defaultDay, onClose }: any) {
  const [subjectId, setSubjectId] = useState(editing?.subjectId ?? data.subjects[0]?.id);
  const [days, setDays] = useState<number[]>(editing ? [editing.day] : [defaultDay]);
  const [start, setStart] = useState(editing?.start ?? '10:00');
  const [end, setEnd] = useState(editing?.end ?? '10:55');
  const [room, setRoom] = useState(editing?.room ?? '');
  const [loc, setLoc] = useState<{ lat: number | null; lng: number | null; radius: number }>({ lat: editing?.lat ?? null, lng: editing?.lng ?? null, radius: editing?.radius ?? (data.settings.defaultRadius ?? 100) });
  const [showMap, setShowMap] = useState(false);
  const [subjOpen, setSubjOpen] = useState(false);
  if (data.subjects.length === 0) {
    return <FormModal pal={pal} title="Add a subject first" onClose={onClose}><Text style={{ color: pal.textSecondary, fontSize: 15, lineHeight: 22 }}>You need at least one subject before adding a class. Close this and tap "Add subject".</Text></FormModal>;
  }
  const toggleDay = (v: number) => setDays(editing ? [v] : days.includes(v) ? days.filter(x => x !== v) : [...days, v]);
  const busy = React.useRef(false);
  const save = () => {
    if (busy.current || days.length === 0) return;   // guard against double-tap
    busy.current = true;
    setData((d: AppData | null) => {
      if (!d) return d;
      if (editing) return materializeToday({ ...d, slots: d.slots.map(s => (s.id === editing.id ? { ...s, subjectId, day: days[0], start, end, room, lat: loc.lat, lng: loc.lng, radius: loc.radius } : s)) });
      const newSlots = days.map(day => ({ id: uid(), subjectId, day, start, end, room, lat: loc.lat, lng: loc.lng, radius: loc.radius, active: true }));
      return materializeToday({ ...d, slots: [...d.slots, ...newSlots] });
    });
    onClose();
  };
  const del = () => {
    setData((d: AppData | null) => (d ? { ...d, slots: d.slots.filter(s => s.id !== editing.id), records: d.records.filter(r => r.slotId !== editing.id) } : d));
    onClose();
  };
  return (
    <>
    <FormModal pal={pal} title={editing ? 'Edit class' : 'Add class'} onClose={onClose} onSave={save} onDelete={editing ? del : undefined}>
      <Field pal={pal} label="Subject">
        {(() => {
          const pill = (s: any) => { const on = s.id === subjectId; return <Pressable key={s.id} onPress={() => setSubjectId(s.id)} style={({ pressed }) => ({ backgroundColor: on ? pal.brand : pal.surfaceAlt, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: on ? '#fff' : pal.text, fontWeight: '600', fontSize: 13 }}>{s.name}</Text></Pressable>; };
          const chevron = (
            <Pressable onPress={() => setSubjOpen(o => !o)} style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, backgroundColor: pal.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
              <Ionicons name={subjOpen ? 'chevron-up' : 'chevron-down'} size={18} color={pal.brand} />
            </Pressable>
          );
          return subjOpen ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {data.subjects.map(pill)}
              {chevron}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }} style={{ flex: 1 }}>
                {data.subjects.map(pill)}
              </ScrollView>
              {data.subjects.length > 2 && chevron}
            </View>
          );
        })()}
      </Field>
      <Field pal={pal} label={editing ? 'Day' : 'Days (tap all that apply)'}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {WEEK.map(d => { const on = days.includes(d.v); return <Pressable key={d.v} onPress={() => toggleDay(d.v)} style={{ backgroundColor: on ? pal.brand : pal.surfaceAlt, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 }}><Text style={{ color: on ? '#fff' : pal.text, fontWeight: '600', fontSize: 13 }}>{d.l}</Text></Pressable>; })}
        </View>
      </Field>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field pal={pal} label="Start" style={{ flex: 1 }}><TimeField pal={pal} value={start} onChange={setStart} /></Field>
        <Field pal={pal} label="End" style={{ flex: 1 }}><TimeField pal={pal} value={end} onChange={setEnd} /></Field>
      </View>
      <Field pal={pal} label="Room / place"><TextInput value={room} onChangeText={setRoom} placeholder="e.g. Room 204" placeholderTextColor={pal.textMuted} style={inputStyle(pal)} /></Field>
      <Field pal={pal} label="Location for GPS check-in">
        <Pressable onPress={() => setShowMap(true)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: pal.surfaceAlt, borderRadius: 10, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
          <Ionicons name="map" size={16} color={pal.brand} />
          <Text style={{ color: pal.brand, fontWeight: '600', fontSize: 14 }}>{loc.lat != null ? 'Location set — tap to change' : 'Set your building on the map'}</Text>
        </Pressable>
        <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 6 }}>{loc.lat != null ? `Saved · ${loc.radius}m radius` : 'Optional — lets Check in verify you are in class.'}</Text>
      </Field>
    </FormModal>
    {showMap && <MapPicker pal={pal} initial={loc} onClose={() => setShowMap(false)} onSave={(l) => { setLoc(l); setShowMap(false); }} />}
    </>
  );
}

/* ---------------- Settings ---------------- */
