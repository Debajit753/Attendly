import { GoogleAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { IS_EXPO_GO } from '../features/env';
import { firebaseConfigured } from './config';
import { cloud } from './firebase';
import { CloudUser, finishGoogleSignIn } from './auth';

/* Phone build: native Google account picker (@react-native-google-signin), then Firebase
   signs in with Google's ID token. The native module isn't in Expo Go, so it is only
   required at call time and the button is hidden there. The web build is googleSignIn.web.ts.
   Android needs no google-services.json: the Web client ID below plus an Android OAuth
   client (package name + SHA-1, created when the Android app is added in Firebase). */

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export const googleAvailable = firebaseConfigured && !IS_EXPO_GO && WEB_CLIENT_ID.length > 0;
export const googleUnavailableReason = IS_EXPO_GO
  ? 'Google sign-in works in the installed app, not in Expo Go.'
  : !WEB_CLIENT_ID ? 'Google sign-in is not set up in this build yet.' : null;

let configured = false;
function lib() {
  if (!googleAvailable) throw Object.assign(new Error('Google sign-in unavailable'), { code: 'google/not-configured' });
  const g = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  if (!configured) { g.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID }); configured = true; }
  return g;
}

/** Shows Google's account picker. Returns null if the user backs out. */
async function googleIdToken(): Promise<string | null> {
  const g = lib();
  try {
    await g.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  } catch {
    throw Object.assign(new Error('Play services'), { code: 'google/play-services' });
  }
  const res = await g.GoogleSignin.signIn();
  if (!g.isSuccessResponse(res)) return null;
  if (!res.data.idToken) throw Object.assign(new Error('No ID token'), { code: 'google/not-configured' });
  return res.data.idToken;
}

export async function signInWithGoogle(): Promise<CloudUser | null> {
  const idToken = await googleIdToken();
  if (!idToken) return null;
  return finishGoogleSignIn(GoogleAuthProvider.credential(idToken));
}

/** Google-only accounts confirm sensitive actions (delete) by picking the account again. */
export async function reauthWithGoogle(): Promise<boolean> {
  const c = cloud();
  if (!c?.auth.currentUser) return false;
  const idToken = await googleIdToken();
  if (!idToken) return false;
  await reauthenticateWithCredential(c.auth.currentUser, GoogleAuthProvider.credential(idToken));
  return true;
}

/** Forget the Google account choice, so the picker shows again next time. */
export async function signOutGoogle(): Promise<void> {
  if (!googleAvailable) return;
  try { await lib().GoogleSignin.signOut(); } catch { /* not signed in with Google */ }
}
