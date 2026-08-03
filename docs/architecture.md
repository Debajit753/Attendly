# Architecture

Attendly is a single-screen-stack Expo app (no router) with a tab-state shell. All logic runs on-device; there is no backend.

## File layout

The Expo app lives in **`app/`**; the repo root holds only `README`, `LICENSE`, `docs/`, and `.github/`. Paths below are relative to `app/`.

```
App.tsx                     # shell: font loading, storage load/save, tab nav, onboarding, tab bar
index.ts                    # Expo entry (registerRootComponent)

src/
  screens/
    Today.tsx               # verdict, ring, streak, today's classes, catch-up card, subject bars
    Stats.tsx               # trend + activity heatmap + subject bars
    Bunk.tsx                # calculator, slider, projection, limiting-subject callout
    Timetable.tsx           # weekly grid, add/edit, copy-a-day, month calendar
    Settings.tsx            # all settings, backup/restore, about
  components/
    ui.tsx                  # shared primitives (Chip, Card, Segment, Stepper, Field, SubjectBar, WEEK, animate, ...)
    AppText.tsx             # Text / TextInput wrappers that apply SF Pro
    Ring.tsx                # SVG attendance ring with the target notch
    Charts.tsx              # trend line, month/heatmap grids
    TimePicker.tsx          # tap-to-open HH:MM wheel (no native dependency)
    forms.tsx               # bottom-sheet forms (subject, class, date row)
    MapPicker.tsx           # Leaflet/OSM map in a WebView (+ web fallback)
  features/                 # native-only, loaded only outside Expo Go
    env.ts                  # IS_EXPO_GO detection
    geofence.ts / .web.ts   # background geofencing task + web stub
    reminders.ts / .web.ts  # class-time local notifications + web stub
  theme.ts                  # colour palette (light + dark)
  logic.ts                  # types, attendance math, projection, sample data, materialisers
  fonts.ts                  # SF Pro font map

assets/                     # app icons + SF Pro .otf fonts
docs/                       # this documentation
tests/                      # unit tests for the attendance math
```

## Data model (AsyncStorage, key `bunksmart:data`)

Plain JSON, computed on the fly (charts and the calculator are never stored):

- **Subject** — `id, name, color, active, target?`
- **Slot** (recurring weekly class) — `id, subjectId, day (0–6), start, end, room, lat, lng, radius, active`
- **Rec** (one per class per date) — `id, slotId, subjectId, date, scheduledStart, status, source?`
  - `status`: `present | late | absent | cancelled | holiday | pending`
  - `subjectId` is copied onto each record so editing a slot never rewrites past history.
- **Settings** — target, countCancelled, theme, term dates, reminders, rounding rule, default radius, grace minutes.

## Materialisers

- `materializeToday(data)` — creates today's `pending` records from the active slots.
- `materializePast(data)` — backfills past class-days (within the term window) that were never opened, so the catch-up review can surface them.
- Both run at app load.

## Native-only modules (important)

`expo-task-manager` (geofencing) and `expo-notifications` (reminders) **crash Expo Go on Android** on import. They are:
- imported **only when `!IS_EXPO_GO`** (`Constants.appOwnership === 'expo'` is the canonical Expo Go check),
- always via a guarded dynamic `import()` / `require()`, never a top-level static import,
- stubbed on web via `.web.ts` siblings (Metro platform resolution).

So the app runs everywhere: web preview (stubs), Expo Go (features hidden), and a dev/preview build (features live).

## Rendering notes

- SF Pro is applied app-wide through `AppText` wrappers that pick the family by `fontWeight`; SVG text sets `fontFamily` directly.
- The theme is light/dark via a `themePref` setting (System / Light / Dark).
- Charts are hand-drawn (`react-native-svg` for the ring/trend, plain `View`s for the heatmaps) — no chart library.
