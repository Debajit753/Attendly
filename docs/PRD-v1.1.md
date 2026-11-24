# Attendly v1.1 PRD: editable calendar, class change, backups, optional account

Status: implemented (Nov 2026). Section 7 fixes, F1 calendar, F2 class change (planned subject frozen, per the user's rule), F3 backups and F4 account + sync are built. See firebase-architecture.md for the cloud design.

## 1. Goals

1. The calendar becomes usable: tap any date to see and fix that day's classes.
2. A student can change the subject of a single class ("10am was Maths but BEEE happened") and mark attendance for it.
3. Data is safe: a validated JSON backup on the phone, with automatic copies.
4. Optional account (Firebase) so data survives a lost phone and moves to a new one.

Non-goals for v1.1: groups or sharing, teacher view, push sync between two phones in real time, social login, any analytics.

## 2. Why the calendar "does not work" today

The month grid in `CalendarHeatmap` ([Charts.tsx](../app/src/components/Charts.tsx)) draws coloured squares only. Dates have no press handler, so nothing happens on tap. Two display bugs are fixed at the same time:

- A day whose classes are all "Late" shows no colour, because only `present` and `absent` are counted.
- Cancelled, holiday and unmarked days look identical to "no class".

## 3. Feature F1: tap a date, fix the day

Tap a date to open a bottom sheet titled with the date (for example "Tue 24 Nov").

- Lists that day's classes with time, subject, room and current status.
- Each row has the same actions as Today: Present, Late, Absent, No class, Holiday, Clear, plus **Change subject** (F2).
- If the date is today or in the past, falls inside the term (when set), and the weekly timetable has classes on that weekday but no records exist yet, the sheet creates them as `pending` when it opens. This is explicit and user-triggered, so it does not create phantom catch-up items.
- Button **Add extra class** (subject, time, status) for a class not in the timetable.
- Button **Mark whole day as holiday**.
- Future dates open read-only ("Planned: 3 classes"). Nothing can be marked in advance.
- Colour rules: all attended (present or late) = green, all absent = red, mix = amber, only cancelled or holiday = neutral with a dot, pending = amber outline, nothing scheduled = grey.

Acceptance: tapping 11 Nov lets me change its status and the percentage on Today and Stats updates immediately.

## 4. Feature F2: change the class for one date

Example: timetable says Maths at 10:00, but BEEE was taught.

- New row action **Change subject** on Today, in the calendar sheet and in the catch-up list.
- The student picks any active subject. The record keeps its slot and time, but its `subjectId` becomes the new subject.
- The record stores `plannedSubjectId` (the timetable subject) so the row shows "BEEE, instead of Maths" and a **Restore** action undoes it.
- Attendance maths needs no change: counts are already per record `subjectId`. The class counts for BEEE only, and Maths loses that class from its totals.
- The student then marks Present, Late or Absent as normal.
- Scope is **this class only**. Making a permanent change stays in Timetable edit.
- Edge cases:
  - If the planned subject is later deleted, the "instead of" label is dropped.
  - If the new subject is deleted, its records are deleted with it (existing behaviour, now with a confirmation, see section 7).
  - Geofence auto check-in still uses the slot location, which is fine because the room does not change.

Acceptance: change Mon 10:00 Maths to BEEE, mark Present, and BEEE shows one more attended class while Maths shows one fewer held class.

## 5. Feature F3: JSON backup on the phone

Keep the existing share-sheet backup and harden it.

- New file format: `{ app: "attendly", schemaVersion: 2, exportedAt, data }`. Restore still accepts the old `bunksmart` v1 files.
- **Restore validates** the file (arrays, ids, ISO dates, status values, numeric coordinates and radius), shows a preview ("5 subjects, 22 classes, 480 records, last record 24 Nov"), asks to confirm, and saves a one-step undo copy of the current data first. Invalid files show a clear error. Nothing is swallowed silently.
- **Automatic backup:** after changes, debounced, write `attendly-auto-YYYY-MM-DD.json` into the app's private storage and keep the last 7.
- **Backup folder (Android):** the student picks a folder once through the system file picker (Storage Access Framework). Backups are also written there, so they survive an uninstall. On iOS the share sheet saves to Files. On web the file downloads.
- Errors in save, export and import are shown to the user.

## 6. Feature F4: optional account with Firebase

The app stays fully usable offline with no account. Sign-in is optional, under Settings, **Account and sync**.

**Auth:** Firebase Authentication with email and password: sign up, sign in, sign out, reset password by email, delete account (also deletes the cloud copy).

**SDK:** Firebase JS SDK (modular) with AsyncStorage persistence for auth. It works on web, Expo Go and dev builds, with no native config files. React Native Firebase is not used because it needs a dev build.

**Cloud data model (Firestore):**

- `users/{uid}/core`: subjects, slots, settings, `updatedAt`.
- `users/{uid}/records_YYYY-MM`: that month's records, `updatedAt`. Splitting by month keeps every document far below the 1 MiB limit.

**Sync rules (local-first, simple):**

- The phone is always the working copy. Saves go to local storage first.
- Push changed documents shortly after edits (debounced) and on app background. Pull on start and on resume.
- Each document is last-write-wins by `updatedAt`. The app also remembers `lastSyncedAt`.
- If both the phone and the cloud changed since `lastSyncedAt`, or this is the first sign-in on a phone that has local data and the cloud also has data, the student is asked: **Use cloud**, **Use this phone**, or **Merge** (per month document, newest wins).
- Sync never runs against a load that failed (see section 7).
- "Sync now" button, last-synced time and an error line are shown.

**Security rules** (shipped as `firestore.rules`): a user can read and write only `users/{their uid}/**`. Size limits are enforced there.

**Privacy:**
- The onboarding line "nothing uploaded, ever" is rewritten: "Stays on this phone unless you turn on sync."
- Synced data includes attendance, timetable and class building coordinates. A toggle **Do not sync class locations** is provided. Coordinates are synced by default so a new phone works, with a clear disclosure.
- Firebase config goes in `app/.env.local` (`EXPO_PUBLIC_FIREBASE_*`), which is already git-ignored. Firebase web keys are identifiers, not secrets, and the Firestore rules are the protection.

**What you need to do (I cannot create this for you):**
1. Create a Firebase project under the Google account you want to own it.
2. Enable Authentication, Email/Password.
3. Create a Firestore database (production mode, choose a region near you).
4. Add a Web app and copy the config values.
5. Give me the values (or paste them into `app/.env.local` yourself) and publish the `firestore.rules` I provide.

## 7. Prerequisite fixes (must land first, they protect new features)

These come from the earlier review and sync would make them worse:

1. A failed read at start must never overwrite stored data. Keep the raw value and show a recovery screen.
2. "Reset to sample data" and deleting a class or subject get confirmations that state what will be lost.
3. `TODAY` is recomputed on app resume and at midnight, so the calendar sheet and Today never show a stale date.
4. CI also runs on pushes to `main`.

## 8. Data model changes

- `Rec` adds `plannedSubjectId?: string` and `updatedAt?: number`.
- `Rec.source` records the real origin: `manual`, `gps`, `geofence`, `extra`.
- Backup file gets `schemaVersion: 2`. The loader migrates older data in place.
- No change to the attendance maths.

## 9. Delivery order

| Phase | Content | Needs from you |
|---|---|---|
| 0 | Section 7 fixes | nothing |
| 1 | F1 calendar sheet and F2 change class, with tests | nothing |
| 2 | F3 backup hardening and automatic backups | nothing |
| 3 | F4 Firebase account and sync, rules file | Firebase project and config |

Phases 0 to 2 can start immediately while the Firebase project is being set up.

## 10. Test plan

- Unit tests: counts after a subject change, restore validation (good, bad, legacy), merge and conflict decisions, colour rule for a day, date rollover.
- Manual in the web preview: tap dates, change a class, restore a bad file, sign in and out.
- Phone (dev build): geofence still marks the right record after a subject change, backup folder survives reinstall.

## 11. Decisions needed from you

| # | Question | My recommendation |
|---|---|---|
| 1 | Sign-in method | Email and password. Google sign-in needs a dev build and SHA-1 setup, so it is a later step. |
| 2 | Conflict handling | Newest wins per document, with a prompt when both sides changed. |
| 3 | Change-class scope | This class only for now. |
| 4 | Sync class coordinates | Yes by default, with a toggle to turn it off. |
| 5 | Start now | Begin Phases 0 to 2 immediately. |
