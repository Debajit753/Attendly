# Attendly

A private college **attendance tracker and bunk calculator** with one-tap, location-verified check-in. It works fully offline on your phone. An optional account (Firebase) keeps a cloud copy so you can move to a new phone.

Built with **Expo (React Native) + TypeScript**. Personal project.

> The question it answers every morning: **"Am I safe to skip today?"**

---

## Features

- **One-tap GPS check-in**: verifies you're at the classroom and marks you present (or late after the grace period).
- **Tap-to-edit calendar**: open any date to mark its classes, add an extra class or mark the day as a holiday.
- **Class swap**: "10:00 was Maths but BEEE was taught". The swapped class counts for BEEE only; Maths is frozen for that date (neither held nor absent).
- **Bunk calculator**: one plain answer per subject ("Skip 5" or "Attend 3"), a "what if I miss N" stepper and an end-of-term projection.
- **Glanceable analytics**: attendance ring with the target notch, cumulative trend, month heatmap, worst-first subject bars, streaks.
- **Honest by design**: a catch-up review so nothing is silently missed; `Present / Late / Absent / Not held / Holiday`; per-subject targets; college rounding rule (round or truncate).
- **Safe data**: a damaged save never overwrites your data, restores are checked and previewed, destructive actions ask first and can be undone once.
- **Backups**: daily automatic backups on the phone (last 7 kept), an optional Android backup folder that survives uninstalling, and manual `.json` backup / restore.
- **Optional account and sync**: email + password (verified email) or Google sign-in. Local-first sync to Firestore, locked down by security rules.
- **Class reminders** and **background auto check-in** (dev or release build).

Full list: **[docs/features.md](docs/features.md)**

## Screenshots

_Add screenshots here._

## Tech stack

| Area | Choice |
|---|---|
| Framework | Expo SDK 58 · React Native 0.88 · TypeScript |
| Storage | AsyncStorage (on-device JSON, the source of truth) |
| Cloud (optional) | Firebase Authentication + Cloud Firestore (JS SDK), Google Sign-In |
| Charts | `react-native-svg` + plain `View`s |
| Location | `expo-location` (check-in + background geofencing) |
| Map | `react-native-webview` + Leaflet + OpenStreetMap (no API key) |
| Notifications | `expo-notifications` (local) |
| Fonts | SF Pro (bundled) via `expo-font` |

## Getting started

**Prerequisites and setup: [docs/requirements.md](docs/requirements.md)**

> The Expo app lives in **`app/`**. Run all `npm` / `expo` / `eas` commands from there.

```bash
cd app
npm install
npm run web        # quick UI checks in the browser
```

The app runs without any cloud setup. To enable accounts and sync, create `app/.env.local` with your Firebase web config and publish `firestore.rules` (see [docs/requirements.md](docs/requirements.md)).

For GPS, reminders and Google sign-in on a phone, build a dev client:

```bash
cd app
npx eas-cli login
npx eas-cli build --profile development --platform android   # ~15 min, cloud
# install the APK, then:
npx expo start --dev-client --lan
```

> Connect over **LAN**, not `--tunnel`: Expo tunnel URLs break on Android when the account name contains an underscore.

## Project structure

```
Attendly/                # repo root: docs, CI, Firebase rules
├── README.md · LICENSE · .gitignore
├── firestore.rules      # Firestore security rules (owner only, verified email, schema checks)
├── firebase.json        # Firebase CLI / emulator config
├── .github/workflows/   # CI: typecheck + unit tests, security-rules tests on the emulator
├── docs/                # features, architecture, requirements, PRD, Firebase design
└── app/                 # the Expo app
    ├── App.tsx          #   shell: load/save, recovery screen, sync, backups, tab nav
    ├── src/
    │   ├── screens/     #   Today · Stats · Bunk · Timetable · Settings · Account
    │   ├── components/  #   ui, Ring, Charts, DaySheet, pickers, forms, MapPicker, dialogs
    │   ├── cloud/       #   Firebase setup, auth, Google sign-in, sync engine, data validator
    │   ├── backup/      #   automatic backups
    │   └── features/    #   geofence + reminders (native-only, guarded) + env
    ├── assets/          #   icons + SF Pro fonts
    ├── tests/           #   unit tests (attendance math, validator, sync, backups)
    ├── rules-tests/     #   Firestore rules tests (run in CI on the emulator)
    └── app.json · eas.json · package.json · tsconfig.json
```

Details: **[docs/architecture.md](docs/architecture.md)** and **[docs/firebase-architecture.md](docs/firebase-architecture.md)**

## Tests

```bash
cd app
npx tsc --noEmit   # types (unused code is an error)
npm test           # unit tests
```

The security-rules tests need Java and the Firebase CLI, so they run in CI. See [docs/requirements.md](docs/requirements.md) to run them locally.

## License

See **[LICENSE](LICENSE)**. Personal, non-commercial project.
It bundles Apple's **SF Pro** fonts for personal use only. Apple's licence covers Apple platforms, so do not redistribute them or ship them in a public Android release.
