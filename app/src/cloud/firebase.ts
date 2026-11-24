import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth, Persistence } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig, firebaseConfigured } from './config';

/* Phone build (Android / iOS). Metro resolves @firebase/auth to its React Native build,
   which provides getReactNativePersistence; the browser typings don't list it, hence
   the typed require. The login is kept in the app's private storage between launches.
   The web build lives in firebase.web.ts. */
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

/** Lazily start Firebase. Returns null if the project isn't configured. */
export function cloud(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  if (!firebaseConfigured) return null;
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    try {
      auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      auth = getAuth(app);   // already initialised (fast refresh during development)
    }
    db = getFirestore(app);
  }
  return { app, auth: auth!, db: db! };
}
