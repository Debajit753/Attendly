import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig, firebaseConfigured } from './config';

/* Web build: the login is kept in the browser's local storage. */
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function cloud(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  if (!firebaseConfigured) return null;
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    try {
      auth = initializeAuth(app, { persistence: browserLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver });
    } catch {
      auth = getAuth(app);
    }
    db = getFirestore(app);
  }
  return { app, auth: auth!, db: db! };
}
