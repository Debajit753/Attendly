# Attendly

A private, offline college **attendance tracker + bunk calculator** with one-tap, location-verified check-in. Everything stays on your phone — no account, no server, nothing uploaded.

Built with **Expo (React Native) + TypeScript**. Personal project.

> The question it answers every morning: **"Am I safe to skip today?"**

---

## Features

- **One-tap GPS check-in** — verifies you're at the classroom and marks you present.
- **Bunk calculator**, both ways — *"How many can I skip and stay ≥ 75%?"* and *"How many must I attend to recover?"* — with a live slider and a limiting-subject callout.
- **End-of-term projection** — set your term dates and see where you'll finish.
- **Glanceable analytics** — attendance ring with a 75% notch, cumulative trend, a GitHub-style month heatmap, worst-first subject bars, and streaks.
- **Honest by design** — an end-of-day *catch-up* review so nothing is silently missed; `Present / Late / Absent / Cancelled / Holiday` states; per-subject targets; college rounding rule (round or truncate).
- **Class reminders** and **background auto check-in** (both need a dev build).
- **Offline & on-device** — data in AsyncStorage, plus manual **backup / restore** to a `.json` file.

Full list → **[docs/features.md](docs/features.md)**

## Screenshots

_Add screenshots here._

## Tech stack

| Area | Choice |
|---|---|
| Framework | Expo SDK 57 · React Native · TypeScript |
| Storage | `@react-native-async-storage/async-storage` (on-device JSON) |
| Charts | `react-native-svg` + plain `View`s |
| Location | `expo-location` (foreground check-in + background geofencing) |
| Map | `react-native-webview` + Leaflet + OpenStreetMap (free, no API key) |
| Notifications | `expo-notifications` (local, dev build only) |
| Fonts | SF Pro (bundled) via `expo-font` |

## Getting started

**Prerequisites and setup → [docs/requirements.md](docs/requirements.md)**

> The Expo app lives in **`app/`** — run all `npm` / `expo` / `eas` commands from there.

```bash
cd app
npm install
npm run web        # quick UI checks in the browser
```

To run the real app on an Android phone (with GPS, notifications, etc.) you build a dev client:

```bash
cd app
npm i -g eas-cli
eas login
eas build --profile development --platform android   # ~15 min, cloud
# install the APK, then:
npx expo start --dev-client --lan
```

> Connect over **LAN**, not `--tunnel` — Expo tunnel URLs break on Android when the account name contains an underscore.

## Project structure

```
Attendly/                # repo root — docs & meta only
├── README.md · LICENSE · .gitignore
├── .github/workflows/   # CI (typecheck + tests)
├── docs/                # features, architecture, requirements
└── app/                 # the Expo app
    ├── App.tsx          #   shell: fonts, storage, tab nav
    ├── src/
    │   ├── screens/     #   Today · Stats · Bunk · Timetable · Settings
    │   ├── components/  #   ui, Ring, Charts, TimePicker, forms, MapPicker, AppText
    │   └── features/    #   geofence + reminders (native-only, guarded) + env
    ├── assets/          #   icons + SF Pro fonts
    ├── tests/           #   attendance-math unit tests
    └── app.json · eas.json · package.json · tsconfig.json
```

Details → **[docs/architecture.md](docs/architecture.md)**

## Tests

```bash
cd app && npm test
```

Covers the attendance math (current %, must-attend, skip budget, end-of-term projection, rounding).

## License

See **[LICENSE](LICENSE)**. Personal, non-commercial project.
It bundles Apple's **SF Pro** fonts for personal use only — do not redistribute them for commercial use.
