# Architecture

Attendly is a single-screen-stack Expo app (no router) with a tab-state shell. All logic runs on-device and the phone is the source of truth. An optional Firebase account mirrors the data to the cloud (see [firebase-architecture.md](firebase-architecture.md)).

## File layout

The Expo app lives in **`app/`**. The repo root holds `README`, `LICENSE`, `docs/`, `.github/`, `firestore.rules` and `firebase.json`. Paths below are relative to `app/`.

```
App.tsx                     # shell: safe load/save, recovery screen, onboarding, sync + backup triggers,
                            #   midnight rollover, tab bar, conflict prompt
index.ts                    # Expo entry (registerRootComponent)

src/
  screens/
    Today.tsx               # verdict, ring, streak, today's classes, catch-up card, subject bars
    Stats.tsx               # trend + activity heatmap + subject bars
    Bunk.tsx                # one-answer calculator, "what if I miss N", projection, limiting subject
    Timetable.tsx           # weekly grid, add/edit, copy-a-day, tappable month calendar
    Settings.tsx            # settings, backups, restore with preview, undo, account entry
    Account.tsx             # sign in / create account / Google, verify email, sync panel, delete account
  components/
    ui.tsx                  # shared primitives (Chip, Card, Segment, Stepper, Field, SubjectBar, WEEK, animate, ...)
    AppText.tsx             # Text / TextInput wrappers that apply SF Pro
    Ring.tsx                # SVG attendance ring; labels are RN Text (Android-safe centring)
    Charts.tsx              # trend line, activity heatmap, month calendar
    DaySheet.tsx            # one date: mark classes, change subject, extra class, whole-day holiday
    TimePicker.tsx          # pure-JS wheels: time picker and date dial
    forms.tsx               # bottom-sheet forms (subject, class, date row)
    MapPicker.tsx           # Leaflet/OSM map in a WebView (+ web fallback)
    confirm.ts              # confirmAsync / notify (native Alert, in-app sheet on web)
    ConfirmHost.tsx         # renders web dialogs (browsers may block window.confirm)
  cloud/
    config.ts               # Firebase config from .env.local
    firebase.ts / .web.ts   # Firebase init (React Native persistence / browser persistence)
    auth.ts                 # email/password, verification, reauth, Google credential linking
    googleSignIn.ts / .web.ts  # native Google picker / web popup
    validate.ts             # one schema check for stored data, backups and cloud data
    syncCore.ts             # pure sync logic: documents, fingerprints, plan, conflicts, merge
    sync.ts                 # Firestore reads/writes, sync metadata
    useCloudSync.ts         # hook: when to sync, status, conflict prompt
  backup/
    backupCore.ts           # pure: file names, pruning, backup format
    autoBackup.ts / .web.ts # daily backups in app storage + optional Android folder (SAF)
  features/                 # native-only, loaded only outside Expo Go
    env.ts                  # IS_EXPO_GO detection
    geofence.ts / .web.ts   # background geofencing task + web stub
    reminders.ts / .web.ts  # class-time local notifications + web stub
  storage.ts                # load (reports damage, never treats it as empty), save, undo stash
  fileShare.ts              # share a text file (share sheet / download)
  theme.ts                  # colour palette (light + dark)
  logic.ts                  # types, attendance math, projection, day/swap helpers, materialisers, live TODAY
  fonts.ts                  # SF Pro font map

tests/                      # unit tests (jest-expo)
rules-tests/                # Firestore rules tests (emulator, CI only)
```

## Data model (AsyncStorage, key `bunksmart:data`)

Plain JSON; charts and calculator results are computed, never stored. The key keeps its original name for existing installs.

- **Term**: `id, name, start, end` (no overlaps). `AppData.terms` lists them; `AppData.activeTermId` is the term being viewed (per device, not synced).
- **Subject**: `id, name, color, active, target?, termId` (each subject belongs to one term; its slots and records follow it)
- **Slot** (recurring weekly class): `id, subjectId, day (0-6), start, end, room, lat, lng, radius, active`
- **Rec** (one per class per date): `id, slotId, subjectId, date, scheduledStart, status, source?, plannedSubjectId?`
  - `status`: `present | late | absent | cancelled | holiday | pending`
  - `subjectId` is copied onto each record, so editing a slot never rewrites history.
  - `plannedSubjectId` is set when a class was swapped to another subject. The planned subject is frozen for that date: the record counts only for `subjectId`.
  - Extra classes use a `slotId` starting with `extra-`.
- **Settings**: target, countCancelled, theme, reminders, rounding rule, default radius, grace minutes. (`termStart` / `termEnd` are filled in by `termView` from the viewed term, never stored.)

## Terms

- `termView(data)` returns only the viewed term's subjects, slots and records; every screen reads it. Writes go to the full data (ids are unique).
- `materializeToday` / `materializePast` only create classes for the term running today; `plannedSlotsOn(date)` uses the term containing that date.
- `startTerm` adds a term and can copy another term's subjects and slots (new ids, no records).
- Old data without terms is migrated by the validator into a deterministic `term-1`, so every device migrates identically.

Everything that enters the app (the stored copy, restored backups, cloud data) goes through `validateAppData`, which rebuilds a clean copy from known fields only.

## Data safety

- **Load**: a read or parse failure shows a recovery screen (retry, save a copy, start fresh). Saving, syncing and backups stay off until data loaded cleanly.
- **Replace** (restore, sample reset, erase, "Keep cloud"): the current data is stashed first, so Settings can undo it once.
- **Removing a class** from the timetable keeps its marked attendance; only its pending entries go.

## Materialisers

- `materializeToday(data)`: creates today's `pending` records from the active slots.
- `materializePast(data)`: backfills past class days (within the term window) so the catch-up review can surface them.
- `ensureDayRecords(data, iso)`: fills in one past date when the user opens it in the calendar.
- They run at app load; `refreshToday()` moves `TODAY` forward after midnight (on resume and once a minute).

## Native-only modules (important)

`expo-task-manager` (geofencing), `expo-notifications` (reminders) and the Google Sign-In module are not available in Expo Go. They are:
- imported **only when `!IS_EXPO_GO`** (`Constants.appOwnership === 'expo'` is the canonical Expo Go check),
- always through a guarded dynamic `import()` / `require()`, never a top-level static import,
- stubbed on web through `.web.ts` siblings (Metro platform resolution).

So the app runs everywhere: web preview (stubs), Expo Go (features hidden), and a dev or release build (features live).

## Rendering notes

- SF Pro is applied app-wide through `AppText` wrappers that pick the family by `fontWeight`.
- Text drawn over SVG (the ring) uses RN `Text`, because react-native-svg mis-centres custom fonts on Android.
- The theme is light/dark via the `themePref` setting (System / Light / Dark).
- Charts are hand-drawn (`react-native-svg` for the ring and trend, plain `View`s for the heatmaps); no chart library.
- The calendar renders one row per week with seven `flex: 1` cells, so dates always line up under their weekday.
