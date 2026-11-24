import { useState } from 'react';
import { View, Pressable, Modal, ScrollView, Switch } from 'react-native';
import { Text, TextInput } from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../theme';
import { AppData, Term, TODAY, addDays, currentTerm, latestTerm, startTerm } from '../logic';
import { DateRow } from './forms';
import { inputStyle, niceDate, SetData } from './ui';

/** Another term whose dates overlap these (terms must not overlap: "today" must map to one term). */
export function overlappingTerm(data: AppData, start: string, end: string, exceptId?: string): Term | undefined {
  return data.terms.find(t => t.id !== exceptId && start <= t.end && t.start <= end);
}

const sheet = (pal: Palette) => ({ position: 'absolute' as const, left: 0, right: 0, bottom: 0, maxWidth: 480, alignSelf: 'center' as const, width: '100%' as const, maxHeight: '88%' as const, backgroundColor: pal.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 });

/** Switch between terms, or start a new one. `data` is the FULL data (all terms). */
export function TermPicker({ pal, data, setData, onClose, startNew = false }: { pal: Palette; data: AppData; setData: SetData; onClose: () => void; startNew?: boolean }) {
  const [creating, setCreating] = useState(startNew);
  const cur = currentTerm(data);
  const terms = [...data.terms].sort((a, b) => b.start.localeCompare(a.start));
  const pick = (id: string) => { setData(d => (d ? { ...d, activeTermId: id } : d)); onClose(); };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={sheet(pal)}>
        <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: pal.border, alignSelf: 'center', marginBottom: 12 }} />
        {creating ? (
          <NewTermForm pal={pal} data={data} onCancel={() => (startNew ? onClose() : setCreating(false))}
            onCreate={(t, copy) => { setData(d => (d ? startTerm(d, t, copy ? d.activeTermId : undefined) : d)); onClose(); }} />
        ) : (
          <>
            <Text style={{ color: pal.text, fontSize: 19, fontWeight: '800', marginBottom: 4 }}>Terms</Text>
            <Text style={{ color: pal.textSecondary, fontSize: 13, marginBottom: 12 }}>Each term keeps its own subjects, timetable, attendance and streak.</Text>
            <ScrollView>
              {terms.map(t => {
                const on = t.id === data.activeTermId;
                return (
                  <Pressable key={t.id} onPress={() => pick(t.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: on ? pal.brandSubtle : 'transparent', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
                    <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? pal.brand : pal.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: pal.text, fontWeight: on ? '700' : '600', fontSize: 15 }} numberOfLines={1}>{t.name}</Text>
                      <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 1 }}>{niceDate(t.start)} to {niceDate(t.end)}</Text>
                    </View>
                    {t.id === cur?.id && <Text style={{ color: pal.brand, fontSize: 12, fontWeight: '700' }}>Now</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setCreating(true)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: pal.brand, borderRadius: 12, paddingVertical: 14, marginTop: 14, opacity: pressed ? 0.85 : 1 })}>
              <Ionicons name="add" size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Start a new term</Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

function NewTermForm({ pal, data, onCreate, onCancel }: { pal: Palette; data: AppData; onCreate: (t: { name: string; start: string; end: string }, copy: boolean) => void; onCancel: () => void }) {
  const last = latestTerm(data);
  const defStart = last && last.end >= TODAY ? addDays(last.end, 1) : TODAY;
  const [name, setName] = useState(`Term ${data.terms.length + 1}`);
  const [start, setStart] = useState<string | undefined>(defStart);
  const [end, setEnd] = useState<string | undefined>(addDays(defStart, 120));
  const viewed = data.terms.find(t => t.id === data.activeTermId);
  const viewedHasSubjects = data.subjects.some(s => s.termId === data.activeTermId);
  const [copy, setCopy] = useState(viewedHasSubjects);
  const [msg, setMsg] = useState<string | null>(null);

  const create = () => {
    if (!name.trim()) { setMsg('Give the term a name, for example "Sem 2".'); return; }
    if (!start || !end) { setMsg('Pick a start and an end date.'); return; }
    if (end < start) { setMsg('The end date is before the start date.'); return; }
    const clash = overlappingTerm(data, start, end);
    if (clash) { setMsg(`These dates overlap ${clash.name} (${niceDate(clash.start)} to ${niceDate(clash.end)}). Terms can't overlap.`); return; }
    onCreate({ name, start, end }, copy && viewedHasSubjects);
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={{ color: pal.text, fontSize: 19, fontWeight: '800', marginBottom: 4 }}>Start a new term</Text>
      <Text style={{ color: pal.textSecondary, fontSize: 13, marginBottom: 14, lineHeight: 19 }}>Attendance starts from zero. Your old terms stay as they are, and you can switch back to them any time.</Text>
      <Text style={{ color: pal.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Sem 2" placeholderTextColor={pal.textMuted} maxLength={40} style={inputStyle(pal)} />
      <View style={{ backgroundColor: pal.surfaceAlt, borderRadius: 12, marginTop: 12 }}>
        <DateRow pal={pal} label="Starts" hint="first day of classes" value={start} onChange={setStart} last={false} />
        <DateRow pal={pal} label="Ends" hint="last day of the term" value={end} onChange={setEnd} last={true} />
      </View>
      {viewedHasSubjects && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: pal.text, fontSize: 15 }}>Copy timetable from {viewed?.name}</Text>
            <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 2 }}>Subjects, class times, rooms and locations. Edit them afterwards in Timetable.</Text>
          </View>
          <Switch value={copy} onValueChange={setCopy} trackColor={{ false: pal.surfaceAlt, true: pal.brand }} thumbColor="#fff" ios_backgroundColor={pal.surfaceAlt} />
        </View>
      )}
      {msg && <Text style={{ color: pal.dangerText, fontSize: 13, marginTop: 12 }}>{msg}</Text>}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Pressable onPress={create} style={({ pressed }) => ({ flex: 1, backgroundColor: pal.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Start term</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={{ paddingHorizontal: 18, justifyContent: 'center' }}><Text style={{ color: pal.textSecondary, fontWeight: '600' }}>Cancel</Text></Pressable>
      </View>
    </ScrollView>
  );
}
