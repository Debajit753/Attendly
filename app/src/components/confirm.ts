import { Alert, Platform } from 'react-native';

/* Confirmations and messages that work everywhere.
   Phones use the native Alert. On web, react-native-web's Alert does nothing and
   embedded browsers often block window.confirm/alert (they silently return "Cancel"),
   so the web build shows an in-app sheet through <ConfirmHost /> instead. */

export type DialogRequest = {
  title: string;
  message: string;
  okLabel: string;
  cancelLabel?: string;     // omitted for a plain message (OK only)
  destructive: boolean;
  resolve: (ok: boolean) => void;
};

let host: ((r: DialogRequest) => void) | null = null;

/** Called by <ConfirmHost /> on mount; returns the unregister function. */
export function registerDialogHost(fn: (r: DialogRequest) => void): () => void {
  host = fn;
  return () => { if (host === fn) host = null; };
}

/** Yes/no confirmation. Resolves false on cancel or dismiss. */
export function confirmAsync(title: string, message: string, okLabel = 'OK', destructive = true): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (host) return new Promise(resolve => host!({ title, message, okLabel, cancelLabel: 'Cancel', destructive, resolve }));
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/** Simple message (errors, results). */
export function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (host) { host({ title, message, okLabel: 'OK', destructive: false, resolve: () => {} }); return; }
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
