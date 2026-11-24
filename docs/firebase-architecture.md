# Attendly: Firebase account and sync architecture

Status: implemented (Nov 2026). Phases 0, A, B and C are built and tested on web and Android; App Check is planned for the Play Store release.

## 1. Principles

1. **Local-first.** The phone (AsyncStorage) is the working copy. Every change saves locally first. The cloud is a mirror.
2. **Optional.** Without signing in, the app behaves exactly as today and nothing leaves the phone.
3. **Deny by default.** The cloud accepts only what the security rules explicitly allow.
4. **No secrets in the app.** The Firebase web config identifies the project; it is not a key to the data. The rules protect the data.

## 2. Components

```
        PHONE (works fully offline)                      FIREBASE (optional)
 ┌──────────────────────────────────────┐        ┌──────────────────────────────┐
 │ Screens (Today, Calendar, Bunk ...)  │        │ Authentication               │
 │        │ setData                     │        │  email + password, Google    │
 │        ▼                             │        │                              │
 │ App state  ──save──►  AsyncStorage   │        │ Firestore                    │
 │        │            (source of truth)│        │  users/{uid}/data/core       │
 │        ▼                             │  push  │  users/{uid}/months/2026-11  │
 │ Sync engine ─────────────────────────┼───────►│  ...                         │
 │  (only when signed in)  ◄────────────┼────────│ Security rules: owner only,  │
 │        │                       pull  │        │ schema and size checked      │
 │        ▼                             │        │                              │
 │ Auto JSON backups (separate, local)  │        │ App Check (dev build)        │
 └──────────────────────────────────────┘        └──────────────────────────────┘
```

| File | Job |
|---|---|
| `src/cloud/firebase.ts` | init from `app/.env.local`, persistent login |
| `src/cloud/auth.ts` | sign up, sign in, Google sign-in, sign out, reset password, verify email, delete account |
| `src/cloud/sync.ts` | split into documents, fingerprints, merge decision (pure, unit tested), push and pull |
| `src/cloud/validate.ts` | one schema check used for cloud data, backups and restore |
| `src/screens/Account.tsx` | sign-in UI, sync status, Sync now, location toggle |
| `firestore.rules` + `tests/rules.test.ts` | security rules and automated tests that prove them |

## 3. Data layout (Firestore)

| Document | Contents |
|---|---|
| `users/{uid}/data/core` | subjects, slots, settings, `schemaVersion`, `updatedAt`, `deviceId` |
| `users/{uid}/months/{YYYY-MM}` | that month's records, `updatedAt`, `deviceId` |

A month is about 30 KB, far below the 1 MiB document limit. Only changed documents are uploaded.

## 4. Sync

- **Push:** a few seconds after a change, when the app goes to the background, and on "Sync now". Only documents whose fingerprint changed since the last sync.
- **Pull:** on sign-in, app start and resume.
- **Decide:** only one side changed since the last sync, so that side wins. Both changed the same document: ask **Keep cloud** or **Keep this phone**.
- **First sign-in:** empty cloud uploads; empty phone downloads; both have data, so ask.
- **Guard:** never upload an empty dataset over a non-empty cloud without asking. Never sync after a failed local load.
- **Offline:** unsent documents stay marked and go up later.

## 5. Authentication

### Email and password (Phase A, works in Expo Go and web)
- Firebase Auth stores and hashes passwords (scrypt). The app never sees or stores a password after sending it.
- Minimum password policy enforced in the Firebase console and checked in the app (at least 8 characters, letters and a number).
- **Email verification is required before sync turns on.** Rules check `email_verified`.
- Email enumeration protection turned on in the console, so sign-in errors don't reveal whether an email has an account.
- Built-in Firebase throttling blocks repeated wrong passwords.
- Sensitive actions (change password, delete account) require signing in again first.

### Google sign-in (Phase B, needs a dev build)
- Uses the native Google Sign-In module (`@react-native-google-signin/google-signin`, used without `google-services.json`, so no Expo config plugin on Android), then `signInWithCredential` with the Google ID token. No password is involved. The Web client ID comes from `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
- Google accounts are already verified, so sync turns on immediately.
- If a Google account and an email account share the same address, the app links them into one account instead of creating a duplicate.
- Does not work in Expo Go (native module). The button is hidden there. Works on web (popup) and in the dev and release builds.
- Setup: OAuth consent screen, Web and Android OAuth client IDs, and the SHA-1 fingerprints of the debug and release keystores (from `eas credentials`) added to the Firebase Android app.

### Sessions
- Firebase ID tokens last one hour and refresh automatically. The refresh token is kept in the app's private storage.
- Sign out clears it from the phone.

## 6. Security

### Injection
- **No SQL anywhere.** Firestore is not a SQL database and the app never builds query strings. The SDK sends structured requests with typed values, so SQL injection has no entry point.
- **Data injection** (a modified client writing unexpected fields or huge documents) is blocked by the rules: allowed keys only, type checks, size and count limits.
- **Script injection:** the map WebView currently builds HTML with coordinates from stored data. Coordinates will be validated as finite numbers before use, and the same validator checks cloud data and restored backups. React escapes all on-screen text; no raw HTML is rendered.

### Firestore rules (outline)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function owner(uid) { return request.auth != null && request.auth.uid == uid
                                 && request.auth.token.email_verified == true; }
    match /users/{uid}/data/core {
      allow read, delete: if owner(uid);
      allow write: if owner(uid)
        && request.resource.data.keys().hasOnly(['subjects','slots','settings','schemaVersion','updatedAt','deviceId'])
        && request.resource.data.subjects.size() <= 100
        && request.resource.data.slots.size() <= 300;
    }
    match /users/{uid}/months/{ym} {
      allow read, delete: if owner(uid);
      allow write: if owner(uid) && ym.matches('^[0-9]{4}-[0-9]{2}$')
        && request.resource.data.keys().hasOnly(['records','updatedAt','deviceId'])
        && request.resource.data.records.size() <= 2000;
    }
    match /{everything=**} { allow read, write: if false; }   // deny the rest
  }
}
```

### Proof, not promises
- **Rules tests** run against the Firebase emulator in CI (`@firebase/rules-unit-testing`). They must show that a signed-out user, another user and an unverified user are all refused, and that oversized or unknown fields are rejected.
- **App Check** (Play Integrity on Android, reCAPTCHA on web) so only the real app can call the project. Planned for the Play Store release (see section 7); until then the rules are the protection.
- **Budget alert** in the Google Cloud console so abuse can't run up a bill (Spark plan stays free; Blaze only if needed later).

### Known limits (honest)
- A rooted phone can read the app's private storage, including the sign-in token.
- "Sign out on all devices" needs the Firebase Admin SDK on a server (Cloud Functions, Blaze plan). Not in scope.
- Security comes from the rules plus App Check; the rules tests are what show they work.

## 7. Phases

| Phase | Content | Runs in Expo Go |
|---|---|---|
| 0 | Failed-load overwrite fix, confirmations, shared validator, WebView coordinate check | yes |
| A | Firebase setup, email sign-in with verification, rules + rules tests, sync engine, conflict prompt | yes |
| B | Google sign-in, account linking, one EAS dev build | no (dev build) |
| C | Automatic JSON backups | yes |
| Release | App Check (Play Integrity + debug token for dev builds), Play Store listing | no |

**Why App Check moved to release:** Play Integrity only vouches for apps installed from Google Play. A sideloaded dev APK would fail it, so enforcing App Check now would lock out the developer's own phone. It ships with the Play Store release, with a registered debug token for dev builds.
