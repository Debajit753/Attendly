import { GoogleAuthProvider, signInWithPopup, reauthenticateWithPopup } from 'firebase/auth';
import { firebaseConfigured } from './config';
import { cloud } from './firebase';
import { CloudUser, finishGoogleSignIn } from './auth';

/* Web build: Firebase's own Google popup. No client ID needed. */

export const googleAvailable = firebaseConfigured;
export const googleUnavailableReason: string | null = null;

export async function signInWithGoogle(): Promise<CloudUser | null> {
  const c = cloud();
  if (!c) return null;
  try {
    const res = await signInWithPopup(c.auth, new GoogleAuthProvider());
    return { uid: res.user.uid, email: res.user.email ?? '', verified: res.user.emailVerified, providers: res.user.providerData.map(p => p.providerId) };
  } catch (e) {
    // Same email already has a password account: hand over to the shared linking flow.
    const cred = GoogleAuthProvider.credentialFromError(e as never);
    if ((e as { code?: string })?.code === 'auth/account-exists-with-different-credential' && cred) return finishGoogleSignIn(cred);
    if ((e as { code?: string })?.code === 'auth/popup-closed-by-user') return null;
    throw e;
  }
}

export async function reauthWithGoogle(): Promise<boolean> {
  const c = cloud();
  if (!c?.auth.currentUser) return false;
  await reauthenticateWithPopup(c.auth.currentUser, new GoogleAuthProvider());
  return true;
}

export async function signOutGoogle(): Promise<void> {}
