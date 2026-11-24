import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as fbSignOut,
  sendEmailVerification, sendPasswordResetEmail, reauthenticateWithCredential,
  EmailAuthProvider, deleteUser, onAuthStateChanged, reload, User,
  AuthCredential, signInWithCredential, linkWithCredential, GoogleAuthProvider,
} from 'firebase/auth';
import { cloud } from './firebase';

/* Email + password sign-in. Firebase stores and hashes passwords; the app never keeps one.
   Error messages are deliberately the same for "no such account" and "wrong password",
   so the app never reveals which emails have accounts. */

export type CloudUser = { uid: string; email: string; verified: boolean; providers: string[] };
const toUser = (u: User | null): CloudUser | null =>
  (u ? { uid: u.uid, email: u.email ?? '', verified: u.emailVerified, providers: u.providerData.map(p => p.providerId) } : null);
/** True when the account can only sign in with Google (no password to re-enter). */
export const googleOnly = (u: CloudUser | null) => !!u && u.providers.includes('google.com') && !u.providers.includes('password');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Password rule (also set it in Firebase console > Authentication > Settings > Password policy). */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (pw.length > 128) return 'Use at most 128 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use letters and at least one number.';
  return null;
}
export const emailProblem = (email: string) => (EMAIL.test(email.trim()) ? null : 'Enter a valid email address.');

/** Friendly, non-revealing messages for Firebase error codes. */
export function authMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-email':
      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':
      return "Couldn't create the account. If you already have one, sign in or reset your password.";
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'That password is too weak. Use at least 8 characters with letters and a number.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'No internet connection. Check it and try again.';
    case 'auth/requires-recent-login':
      return 'Please enter your password again to continue.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/account-exists-with-different-credential':
      return 'This email already has a password account. Sign in with your password once, and Google will be linked to it.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'The browser blocked the Google window. Allow pop-ups and try again.';
    case 'google/play-services':
      return 'Google Play services is missing or out of date on this phone.';
    case 'google/not-configured':
      return 'Google sign-in is not set up in this build yet.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

function need() {
  const c = cloud();
  if (!c) throw Object.assign(new Error('Cloud is not set up'), { code: 'app/not-configured' });
  return c;
}

export function watchUser(cb: (u: CloudUser | null) => void): () => void {
  const c = cloud();
  if (!c) { cb(null); return () => {}; }
  return onAuthStateChanged(c.auth, u => cb(toUser(u)));
}

export async function signUp(email: string, password: string): Promise<CloudUser> {
  const { auth } = need();
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await sendEmailVerification(cred.user);
  return toUser(cred.user)!;
}

export async function signIn(email: string, password: string): Promise<CloudUser> {
  const { auth } = need();
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return toUser(cred.user)!;
}

export async function signOut(): Promise<void> {
  const c = cloud();
  if (c) await fbSignOut(c.auth);
}

/** Always "succeeds" from the user's point of view, so it can't be used to probe emails. */
export async function resetPassword(email: string): Promise<void> {
  const { auth } = need();
  try { await sendPasswordResetEmail(auth, email.trim()); } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'auth/network-request-failed' || code === 'auth/too-many-requests') throw e;
  }
}

export async function resendVerification(): Promise<void> {
  const { auth } = need();
  if (auth.currentUser) await sendEmailVerification(auth.currentUser);
}

/** Re-read the account (after the user taps the link in the verification email). */
export async function refreshUser(): Promise<CloudUser | null> {
  const { auth } = need();
  if (!auth.currentUser) return null;
  await reload(auth.currentUser);
  await auth.currentUser.getIdToken(true);   // new token carries email_verified for the rules
  return toUser(auth.currentUser);
}

/** Sensitive actions need the password again (Firebase also enforces a recent login). */
export async function confirmPassword(password: string): Promise<void> {
  const { auth } = need();
  const u = auth.currentUser;
  if (!u || !u.email) throw Object.assign(new Error('Not signed in'), { code: 'auth/requires-recent-login' });
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password));
}

/** Deletes the login. Call deleteCloudData() first (sync.ts) so no data is left behind. */
export async function deleteAccount(): Promise<void> {
  const { auth } = need();
  if (auth.currentUser) await deleteUser(auth.currentUser);
}

/** Google credential waiting to be linked after the user signs in with their password. */
let pendingGoogle: AuthCredential | null = null;
export const hasPendingGoogle = () => pendingGoogle !== null;

/** Sign in to Firebase with a Google credential. If the email already belongs to a password
    account, remember the Google credential and ask for the password; it is linked on that sign-in. */
export async function finishGoogleSignIn(cred: AuthCredential): Promise<CloudUser> {
  const { auth } = need();
  try {
    const res = await signInWithCredential(auth, cred);
    return toUser(res.user)!;
  } catch (e) {
    if ((e as { code?: string })?.code === 'auth/account-exists-with-different-credential') {
      pendingGoogle = GoogleAuthProvider.credentialFromError(e as never) ?? cred;
    }
    throw e;
  }
}

/** Called after a successful password sign-in: attach the remembered Google credential. */
export async function linkPendingGoogle(): Promise<boolean> {
  const { auth } = need();
  if (!pendingGoogle || !auth.currentUser) return false;
  const cred = pendingGoogle;
  pendingGoogle = null;
  await linkWithCredential(auth.currentUser, cred);
  return true;
}
