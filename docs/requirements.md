# Requirements & setup

> **The Expo app lives in `app/`** — run every command in this file from there (`cd app` first).
>
> Dependencies are declared in **`app/package.json`** and locked in **`app/package-lock.json`**; `npm install` installs them. This file lists the toolchain you need around it.

## Toolchain

| Tool | Version | Why |
|---|---|---|
| **Node.js** | 20 or newer | runtime for Metro / the tooling |
| **npm** | bundled with Node | installs dependencies |
| **Expo SDK** | 57 | the app is pinned to SDK 57 — read the exact docs at <https://docs.expo.dev/versions/v57.0.0/> before changing native code |
| **eas-cli** | latest (`npm i -g eas-cli`) | cloud builds (dev / preview APKs) |
| **A phone** | Android (tested on Android 10) | GPS, notifications, geofencing |

No Android Studio or local SDK is required — builds run on Expo's cloud (EAS).

## Install

```bash
cd app
npm install
```

## Run

**Web (quick UI checks — location/notifications are stubbed):**
```bash
npm run web        # http://localhost:8081
```

**Phone — development build** (needed for GPS, reminders, background check-in):
```bash
npm i -g eas-cli
eas login
eas build --profile development --platform android   # cloud APK, ~15 min
# install the APK on the phone, then:
npx expo start --dev-client --lan
```
Connect over **LAN**, not `--tunnel`.

**Phone — standalone app for daily use:**
```bash
eas build --profile preview --platform android       # a normal, offline APK
```

## Typecheck & test

```bash
npx tsc --noEmit   # types
npm test           # attendance-math unit tests
```

## Key runtime dependencies

Pulled from `package.json` (see it for exact versions):

- `expo`, `expo-font`, `expo-location`, `expo-notifications`, `expo-task-manager`, `expo-constants`, `expo-status-bar`
- `expo-file-system`, `expo-sharing`, `expo-document-picker` (backup / restore)
- `react`, `react-native`, `react-native-web`
- `react-native-svg` (charts), `react-native-webview` (map), `react-native-safe-area-context`
- `@react-native-async-storage/async-storage`, `@react-native-community/slider`, `@expo/vector-icons`
