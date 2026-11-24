/* Firebase web config from app/.env.local (git-ignored). These values identify the
   project; they are not secrets. The Firestore security rules protect the data.
   Each variable must be read literally as process.env.EXPO_PUBLIC_* so Expo can
   inline it at build time. */
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

/** False when .env.local is missing or incomplete: the app then hides the account feature. */
export const firebaseConfigured = Object.values(firebaseConfig).every(v => v.length > 0);
