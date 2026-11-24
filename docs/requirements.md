# Requirements & setup

> **The Expo app lives in `app/`.** Run every command in this file from there (`cd app` first) unless it says otherwise.
>
> Dependencies are declared in **`app/package.json`** and locked in **`app/package-lock.json`**; `npm install` installs them. This file lists the toolchain you need around it.

## Toolchain

| Tool | Version | Why |
|---|---|---|
| **Node.js** | 22.13 or newer (required by Expo SDK 58) | runtime for Metro and the tooling |
| **npm** | bundled with Node | installs dependencies |
| **Expo SDK** | 58 | read the matching docs at <https://docs.expo.dev/versions/v58.0.0/> before changing native code |
| **eas-cli** | latest, via `npx eas-cli` | cloud builds (dev / preview APKs) |
| **A phone** | Android | GPS, notifications, geofencing, Google sign-in |
| Java 21 + Firebase CLI | optional | only to run the security-rules tests locally (CI runs them anyway) |

No Android Studio or local Android SDK is required: builds run on Expo's cloud (EAS).

> **Windows PowerShell:** if `npx` fails with "running scripts is disabled", use `npx.cmd` instead (for example `npx.cmd eas-cli login`).

## Install

```bash
cd app
npm install
```

## Cloud sync (optional)

The app works fully offline without this. To enable accounts and sync:

1. Create a Firebase project. Enable **Authentication > Email/Password** (and **Google** for Google sign-in).
2. Create a **Firestore** database in **production mode**.
3. Publish the rules: paste the repo's `firestore.rules` into **Firestore > Rules** and click **Publish**. Re-publish whenever `firestore.rules` changes (for example, terms added a `terms` field): until then sync reports "The cloud refused the upload".
4. In **Authentication > Settings**, set a password policy (8+ characters, require a number) and keep **email enumeration protection** on.
5. Add a **Web app** in Project settings and put its config in `app/.env.local` (git-ignored):

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...   # Authentication > Google > Web SDK configuration
```

6. For Google sign-in on Android, add an **Android app** in Project settings with package `com.debajit753.attendly` and the build's **SHA-1** (expo.dev > project > Credentials > Android). No `google-services.json` is needed.

Restart the dev server after editing `.env.local`.

**Release builds** (`preview`, `production`) build the JavaScript on EAS, which can't see `.env.local`. Add the same `EXPO_PUBLIC_*` values as EAS environment variables for those profiles first.

## Run

**Web** (quick UI checks; location, notifications and automatic backups are stubbed):
```bash
npm run web        # http://localhost:8081
```

**Phone, development build** (needed for GPS, reminders, background check-in, Google sign-in):
```bash
npx eas-cli login
npx eas-cli build --profile development --platform android   # cloud APK, ~15 min
# install the APK on the phone, then:
npx expo start --dev-client --lan
```
Open the app and connect to `http://<your PC's LAN IP>:8081`. Connect over **LAN**, not `--tunnel`.

**Phone, standalone app for daily use:**
```bash
npx eas-cli build --profile preview --platform android       # a normal, offline APK
```

## Typecheck & test

```bash
npx tsc --noEmit   # types; unused imports and variables are errors
npm test           # unit tests: attendance math, validator, sync, backups
```

Security-rules tests (need Java 21; from the **repo root**):
```bash
npx firebase-tools emulators:exec --only firestore --project demo-attendly "npm --prefix app run test:rules"
```

## Key runtime dependencies

From `package.json` (see it for exact versions):

- `expo`, `expo-font`, `expo-location`, `expo-notifications`, `expo-task-manager`, `expo-constants`, `expo-status-bar`, `expo-dev-client`
- `expo-file-system`, `expo-sharing`, `expo-document-picker` (backups, restore)
- `firebase` (Auth + Firestore), `@react-native-google-signin/google-signin`
- `react`, `react-native`, `react-native-web`
- `react-native-svg` (charts), `react-native-webview` (map), `react-native-safe-area-context`
- `@react-native-async-storage/async-storage`, `@expo/vector-icons`
