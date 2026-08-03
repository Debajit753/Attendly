import React, { useState } from 'react';
import { View, Pressable, ScrollView, Modal } from 'react-native';
import { Text } from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../theme';

/* Tap-to-open time picker (pure JS wheel — no native module). */
export const pad2 = (n: number) => String(n).padStart(2, '0');
export function TimeField({ pal, value, onChange }: { pal: Palette; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => ({ backgroundColor: pal.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ color: pal.text, fontSize: 16 }}>{value || '––:––'}</Text>
        <Ionicons name="time-outline" size={18} color={pal.brand} />
      </Pressable>
      {open && <TimePicker pal={pal} value={value} onClose={() => setOpen(false)} onSave={(v) => { onChange(v); setOpen(false); }} />}
    </>
  );
}
export const TIME_ITEM = 44;
export function TimeColumn({ pal, items, sel, onPick, colRef }: { pal: Palette; items: number[]; sel: number; onPick: (n: number) => void; colRef: React.RefObject<ScrollView | null> }) {
  return (
    <ScrollView ref={colRef} showsVerticalScrollIndicator={false} style={{ height: TIME_ITEM * 5, width: 76 }} contentContainerStyle={{ paddingVertical: TIME_ITEM * 2 }} snapToInterval={TIME_ITEM} decelerationRate="fast">
      {items.map(n => {
        const on = n === sel;
        return (
          <Pressable key={n} onPress={() => onPick(n)} style={{ height: TIME_ITEM, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: on ? pal.brand : pal.textSecondary, fontSize: on ? 25 : 19, fontWeight: on ? '800' : '500', opacity: on ? 1 : 0.5 }}>{pad2(n)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
export function TimePicker({ pal, value, onClose, onSave }: { pal: Palette; value: string; onClose: () => void; onSave: (v: string) => void }) {
  const [h0, m0] = (value || '10:00').split(':').map(Number);
  const [hr, setHr] = useState(isNaN(h0) ? 10 : Math.min(23, Math.max(0, h0)));
  const [mn, setMn] = useState(isNaN(m0) ? 0 : Math.min(59, Math.max(0, m0)));
  const hRef = React.useRef<ScrollView>(null), mRef = React.useRef<ScrollView>(null);
  React.useEffect(() => {
    const t = setTimeout(() => {
      hRef.current?.scrollTo({ y: (isNaN(h0) ? 10 : h0) * TIME_ITEM, animated: false });
      mRef.current?.scrollTo({ y: (isNaN(m0) ? 0 : m0) * TIME_ITEM, animated: false });
    }, 40);
    return () => clearTimeout(t);
  }, []);
  const pickH = (n: number) => { setHr(n); hRef.current?.scrollTo({ y: n * TIME_ITEM, animated: true }); };
  const pickM = (n: number) => { setMn(n); mRef.current?.scrollTo({ y: n * TIME_ITEM, animated: true }); };
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = Array.from({ length: 60 }, (_, i) => i);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxWidth: 480, alignSelf: 'center', width: '100%', backgroundColor: pal.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 }}>
        <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: pal.border, alignSelf: 'center', marginBottom: 12 }} />
        <Text style={{ color: pal.text, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>Pick a time</Text>
        <Text style={{ color: pal.brand, fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 2, marginBottom: 12 }}>{pad2(hr)}:{pad2(mn)}</Text>
        <View style={{ height: TIME_ITEM * 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <View pointerEvents="none" style={{ position: 'absolute', left: 24, right: 24, top: TIME_ITEM * 2, height: TIME_ITEM, backgroundColor: pal.brandSubtle, borderRadius: 12 }} />
          <TimeColumn pal={pal} items={hours} sel={hr} onPick={pickH} colRef={hRef} />
          <Text style={{ color: pal.text, fontSize: 24, fontWeight: '800' }}>:</Text>
          <TimeColumn pal={pal} items={mins} sel={mn} onPick={pickM} colRef={mRef} />
        </View>
        <Text style={{ color: pal.textMuted, fontSize: 11.5, textAlign: 'center', marginTop: 8 }}>Tap a number to set it · 24-hour</Text>
        <Pressable onPress={() => onSave(`${pad2(hr)}:${pad2(mn)}`)} style={({ pressed }) => ({ backgroundColor: pal.brand, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 14, opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
