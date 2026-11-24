import { useEffect, useState } from 'react';
import { View, Pressable, Modal, Platform } from 'react-native';
import { Text } from './AppText';
import { Palette } from '../theme';
import { DialogRequest, registerDialogHost } from './confirm';

/** Renders confirmAsync()/notify() requests as an in-app sheet on web (phones use native Alert). */
export function ConfirmHost({ pal }: { pal: Palette }) {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  useEffect(() => (Platform.OS === 'web' ? registerDialogHost(r => setQueue(q => [...q, r])) : undefined), []);
  const req = queue[0];
  if (!req) return null;
  const done = (ok: boolean) => { req.resolve(ok); setQueue(q => q.slice(1)); };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => done(false)}>
      <Pressable onPress={() => done(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: pal.surface, borderRadius: 18, padding: 20, maxWidth: 420, width: '100%', alignSelf: 'center' }}>
          <Text style={{ color: pal.text, fontSize: 18, fontWeight: '800' }}>{req.title}</Text>
          <Text style={{ color: pal.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6 }}>{req.message}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            {req.cancelLabel && (
              <Pressable onPress={() => done(false)} style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, backgroundColor: pal.surfaceAlt, opacity: pressed ? 0.7 : 1 })}>
                <Text style={{ color: pal.text, fontWeight: '600' }}>{req.cancelLabel}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => done(true)} style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, backgroundColor: req.destructive ? pal.danger : pal.brand, opacity: pressed ? 0.8 : 1 })}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{req.okLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
