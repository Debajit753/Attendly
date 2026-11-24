import { useEffect, useState } from 'react';
import { View, Pressable, Switch, ActivityIndicator, Modal } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../theme';
import { Title, Sub, inputStyle } from '../components/ui';
import { confirmAsync, notify } from '../components/confirm';
import { firebaseConfigured } from '../cloud/config';
import {
  signIn, signUp, signOut, resetPassword, resendVerification, refreshUser, confirmPassword,
  deleteAccount, authMessage, passwordProblem, emailProblem, CloudUser,
  googleOnly, hasPendingGoogle, linkPendingGoogle,
} from '../cloud/auth';
import { googleAvailable, googleUnavailableReason, signInWithGoogle, reauthWithGoogle, signOutGoogle } from '../cloud/googleSignIn';
import { deleteCloudData, getSyncLocations, setSyncLocations } from '../cloud/sync';
import type { SyncStatus } from '../cloud/useCloudSync';

type Cloud = { user: CloudUser | null; status: SyncStatus; syncNow: () => void; setUser: (u: CloudUser | null) => void };

const ago = (iso?: string) => {
  if (!iso) return 'never';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(iso).toLocaleString();
};

export function AccountScreen({ pal, cloud, onBack }: { pal: Palette; cloud: Cloud; onBack: () => void }) {
  const back = (
    <Pressable onPress={onBack} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 }}>
      <Ionicons name="chevron-back" size={18} color={pal.brand} /><Text style={{ color: pal.brand, fontWeight: '600' }}>Settings</Text>
    </Pressable>
  );
  if (!firebaseConfigured) {
    return (
      <View>{back}<Title pal={pal}>Account and sync</Title>
        <Sub pal={pal}>Cloud sync isn't set up in this build (missing Firebase config). Everything still works on this phone.</Sub>
      </View>
    );
  }
  return (
    <View>
      {back}
      <Title pal={pal}>Account and sync</Title>
      <Sub pal={pal}>Optional. Without an account everything stays on this phone.</Sub>
      {!cloud.user ? <SignInForm pal={pal} /> : !cloud.user.verified ? <VerifyEmail pal={pal} cloud={cloud} /> : <SyncPanel pal={pal} cloud={cloud} />}
    </View>
  );
}

function Btn({ pal, label, onPress, kind = 'primary', busy, disabled }: { pal: Palette; label: string; onPress: () => void; kind?: 'primary' | 'plain' | 'danger'; busy?: boolean; disabled?: boolean }) {
  const bg = kind === 'primary' ? pal.brand : pal.surfaceAlt;
  const fg = kind === 'primary' ? '#fff' : kind === 'danger' ? pal.danger : pal.text;
  return (
    <Pressable onPress={onPress} disabled={busy || disabled} style={({ pressed }) => ({ backgroundColor: bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 })}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{label}</Text>}
    </Pressable>
  );
}

function SignInForm({ pal }: { pal: Palette }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  const submit = async () => {
    const e = emailProblem(email);
    if (e) { setMsg({ text: e }); return; }
    if (mode === 'up') {
      const p = passwordProblem(pw);
      if (p) { setMsg({ text: p }); return; }
      if (pw !== pw2) { setMsg({ text: "The two passwords don't match." }); return; }
    } else if (!pw) { setMsg({ text: 'Enter your password.' }); return; }
    setBusy(true); setMsg(null);
    try {
      if (mode === 'up') await signUp(email, pw);
      else {
        await signIn(email, pw);
        if (hasPendingGoogle()) await linkPendingGoogle();   // finish "same email, link Google"
      }
      setPw(''); setPw2('');
    } catch (err) { setMsg({ text: authMessage(err) }); }
    finally { setBusy(false); }
  };
  const google = async () => {
    setBusy(true); setMsg(null);
    try { await signInWithGoogle(); }
    catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/account-exists-with-different-credential') setMode('in');
      setMsg({ text: authMessage(err) });
    }
    finally { setBusy(false); }
  };
  const forgot = async () => {
    const e = emailProblem(email);
    if (e) { setMsg({ text: 'Type your email above first, then tap Forgot password.' }); return; }
    setBusy(true);
    try { await resetPassword(email); setMsg({ text: 'If an account exists for that email, a reset link is on its way.', ok: true }); }
    catch (err) { setMsg({ text: authMessage(err) }); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ backgroundColor: pal.surface, borderRadius: 16, padding: 16, marginTop: 6 }}>
      {googleAvailable ? (
        <>
          <Pressable onPress={google} disabled={busy} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: pal.border, borderRadius: 12, paddingVertical: 13, opacity: pressed || busy ? 0.7 : 1 })}>
            <Ionicons name="logo-google" size={18} color={pal.text} />
            <Text style={{ color: pal.text, fontWeight: '700', fontSize: 15 }}>Continue with Google</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: pal.hair }} />
            <Text style={{ color: pal.textMuted, fontSize: 12 }}>or use email</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: pal.hair }} />
          </View>
        </>
      ) : googleUnavailableReason ? (
        <Text style={{ color: pal.textMuted, fontSize: 12, marginBottom: 12 }}>{googleUnavailableReason}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', backgroundColor: pal.surfaceAlt, borderRadius: 9, padding: 2, marginBottom: 14 }}>
        {(['in', 'up'] as const).map(m => (
          <Pressable key={m} onPress={() => { setMode(m); setMsg(null); }} style={{ flex: 1, backgroundColor: mode === m ? pal.surface : 'transparent', borderRadius: 7, paddingVertical: 8, alignItems: 'center' }}>
            <Text style={{ color: pal.text, fontWeight: mode === m ? '700' : '500' }}>{m === 'in' ? 'Sign in' : 'Create account'}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={pal.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" style={inputStyle(pal)} />
      <View style={{ height: 10 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput value={pw} onChangeText={setPw} placeholder="Password" placeholderTextColor={pal.textMuted} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false}
          textContentType={mode === 'up' ? 'newPassword' : 'password'} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} style={[inputStyle(pal), { flex: 1 }]} />
        <Pressable onPress={() => setShow(s => !s)} hitSlop={8} accessibilityLabel={show ? 'Hide password' : 'Show password'}><Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={pal.textMuted} /></Pressable>
      </View>
      {mode === 'up' && (
        <>
          <View style={{ height: 10 }} />
          <TextInput value={pw2} onChangeText={setPw2} placeholder="Repeat password" placeholderTextColor={pal.textMuted} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} textContentType="newPassword" style={inputStyle(pal)} />
          <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 8 }}>At least 8 characters, with letters and a number. We'll email you a link to verify the address before sync turns on.</Text>
        </>
      )}
      {msg && <Text style={{ color: msg.ok ? pal.safeText : pal.dangerText, fontSize: 13, marginTop: 10 }}>{msg.text}</Text>}
      <Btn pal={pal} label={mode === 'up' ? 'Create account' : 'Sign in'} onPress={submit} busy={busy} />
      {mode === 'in' && (
        <Pressable onPress={forgot} disabled={busy} style={{ alignItems: 'center', paddingTop: 14 }}><Text style={{ color: pal.brand, fontWeight: '600' }}>Forgot password?</Text></Pressable>
      )}
    </View>
  );
}

function VerifyEmail({ pal, cloud }: { pal: Palette; cloud: Cloud }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const check = async () => {
    setBusy('check'); setMsg(null);
    try {
      const u = await refreshUser();
      if (u?.verified) cloud.setUser(u);
      else setMsg({ text: "Not verified yet. Open the link in the email, then tap this again." });
    } catch (e) { setMsg({ text: authMessage(e) }); }
    finally { setBusy(null); }
  };
  const resend = async () => {
    setBusy('resend'); setMsg(null);
    try { await resendVerification(); setMsg({ text: 'Sent. Check your inbox and spam folder.', ok: true }); }
    catch (e) { setMsg({ text: authMessage(e) }); }
    finally { setBusy(null); }
  };
  return (
    <View style={{ backgroundColor: pal.surface, borderRadius: 16, padding: 16, marginTop: 6 }}>
      <Ionicons name="mail-unread-outline" size={34} color={pal.brand} />
      <Text style={{ color: pal.text, fontSize: 17, fontWeight: '800', marginTop: 8 }}>Verify your email</Text>
      <Text style={{ color: pal.textSecondary, fontSize: 13.5, lineHeight: 20, marginTop: 4 }}>We sent a link to {cloud.user?.email}. Sync turns on once the address is verified.</Text>
      {msg && <Text style={{ color: msg.ok ? pal.safeText : pal.dangerText, fontSize: 13, marginTop: 10 }}>{msg.text}</Text>}
      <Btn pal={pal} label="I've verified it" onPress={check} busy={busy === 'check'} />
      <Btn pal={pal} label="Resend the email" onPress={resend} kind="plain" busy={busy === 'resend'} />
      <Btn pal={pal} label="Sign out" onPress={() => signOut()} kind="plain" />
    </View>
  );
}

function SyncPanel({ pal, cloud }: { pal: Palette; cloud: Cloud }) {
  const [locs, setLocs] = useState(true);
  const [askPw, setAskPw] = useState(false);
  useEffect(() => { getSyncLocations().then(setLocs); }, []);
  const st = cloud.status;
  const line = st.state === 'syncing' ? 'Syncing…'
    : st.state === 'waiting' ? 'Waiting for your choice about changed data.'
    : st.state === 'error' ? st.message
    : `Last synced ${ago('lastSyncedAt' in st ? st.lastSyncedAt : undefined)}`;
  const toggleLocs = async (v: boolean) => { setLocs(v); await setSyncLocations(v); cloud.syncNow(); };
  const doSignOut = async () => {
    const ok = await confirmAsync('Sign out?', 'Your data stays on this phone. Sync stops until you sign in again.', 'Sign out', false);
    if (ok) { await signOutGoogle(); await signOut(); }
  };

  return (
    <>
      <View style={{ backgroundColor: pal.surface, borderRadius: 16, padding: 16, marginTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name={st.state === 'error' ? 'cloud-offline-outline' : 'cloud-done-outline'} size={26} color={st.state === 'error' ? pal.danger : pal.brand} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: pal.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{cloud.user?.email}</Text>
            <Text style={{ color: st.state === 'error' ? pal.dangerText : pal.textSecondary, fontSize: 12.5, marginTop: 2 }}>{line}</Text>
          </View>
        </View>
        <Btn pal={pal} label="Sync now" onPress={cloud.syncNow} busy={st.state === 'syncing'} />
      </View>

      <View style={{ backgroundColor: pal.surface, borderRadius: 16, padding: 16, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: pal.text, fontSize: 15 }}>Sync class locations</Text>
          <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 }}>Building coordinates for GPS check-in. Turn off to keep them only on this phone.</Text>
        </View>
        <Switch value={locs} onValueChange={toggleLocs} trackColor={{ false: pal.surfaceAlt, true: pal.brand }} thumbColor="#fff" ios_backgroundColor={pal.surfaceAlt} />
      </View>

      <View style={{ marginTop: 14 }}>
        <Btn pal={pal} label="Sign out" onPress={doSignOut} kind="plain" />
        <Btn pal={pal} label="Delete account and cloud data" onPress={() => setAskPw(true)} kind="danger" />
        <Text style={{ color: pal.textMuted, fontSize: 12, marginTop: 8, lineHeight: 17 }}>Deleting removes your account and everything stored in the cloud. The data on this phone is kept.</Text>
      </View>
      {askPw && <DeleteAccount pal={pal} uid={cloud.user!.uid} viaGoogle={googleOnly(cloud.user)} onClose={() => setAskPw(false)} />}
    </>
  );
}

/** Deleting needs the password again. Cloud data goes first, then the login. */
function DeleteAccount({ pal, uid, viaGoogle, onClose }: { pal: Palette; uid: string; viaGoogle: boolean; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const go = async () => {
    if (!viaGoogle && !pw) { setMsg('Enter your password.'); return; }
    setBusy(true); setMsg(null);
    try {
      if (viaGoogle) { if (!(await reauthWithGoogle())) { setBusy(false); return; } }
      else await confirmPassword(pw);
      await deleteCloudData(uid);
      await deleteAccount();
      await signOutGoogle();
      onClose();
      notify('Account deleted', 'Your cloud data and account are gone. Everything on this phone is still here.');
    } catch (e) { setMsg(authMessage(e)); }
    finally { setBusy(false); }
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxWidth: 480, alignSelf: 'center', width: '100%', backgroundColor: pal.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 }}>
        <Text style={{ color: pal.text, fontSize: 19, fontWeight: '800' }}>Delete account?</Text>
        <Text style={{ color: pal.textSecondary, fontSize: 13.5, lineHeight: 20, marginTop: 4, marginBottom: 12 }}>This permanently removes your account and all cloud data. It can't be undone. {viaGoogle ? 'Pick your Google account again to confirm.' : 'Enter your password to confirm.'}</Text>
        {!viaGoogle && <TextInput value={pw} onChangeText={setPw} placeholder="Password" placeholderTextColor={pal.textMuted} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="password" style={inputStyle(pal)} />}
        {msg && <Text style={{ color: pal.dangerText, fontSize: 13, marginTop: 10 }}>{msg}</Text>}
        <Btn pal={pal} label="Delete permanently" onPress={go} kind="danger" busy={busy} />
        <Btn pal={pal} label="Cancel" onPress={onClose} kind="plain" />
      </View>
    </Modal>
  );
}
