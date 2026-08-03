# Features

## Screens

### Today
- **Verdict banner** — a plain-language answer up top (*"You're safe — skip 4 more"* / *"Below 75% — attend the next N"*).
- **Attendance ring** with the target marked as a notch, coloured by zone (safe / cutting-it-close / needs-attention / building).
- **Streak** card (current + best).
- **Today's classes** — each row is swipeable (right = present, left = absent), has a one-tap **Check in** (GPS), and a `•••` menu (Present / Late / Absent / No class held / Holiday / Clear).
- **Catch-up card** — surfaces past classes you never marked, with quick Present/Absent/Cancelled buttons, so your % is never silently wrong.
- **Worst-first subject bars** with a shared target line.

### Stats
- **Cumulative trend** line with the target line and a since-start delta.
- **Activity heatmap** — a GitHub/LeetCode-style month grid (month labels on top, Mon/Wed/Fri on the left), coloured Present / Absent / Partial / No-class. Spans the current term when term dates are set, else the last 6 months.
- **Subject bars** for every active subject.

### Bunk calculator
- Segmented **"Can I skip?" ⇄ "Must I attend?"**, a big result, and a **live slider** that flips to the danger state the moment the projection crosses the target.
- **End-of-term projection** — *attend all → X% / skip all → Y%*, how many of the remaining you can still miss, and an honest "not recoverable this term" warning.
- **Limiting-subject callout** — *"Physics is tightest — 0 skips left"*, tap to focus it.

### Timetable
- Weekly day picker; add / edit / delete subjects and classes.
- **Time picker** — a scrollable HH:MM wheel (pure JS, no native dependency).
- **Copy-a-day** — duplicate one day's classes onto other days.
- **Set the classroom on a map** — pan a real map (Leaflet + OpenStreetMap) under a fixed centre pin, pick a radius.
- A **month calendar** heat-mapped by attendance.

### Settings
- Target %, count-cancelled toggle, per-subject targets.
- **Term start / end** — scopes your % to the semester and powers projections.
- **Check-in** — default radius, grace period (after which a check-in counts as *Late*).
- **Rounding rule** — round or truncate (for colleges that truncate 74.6% → 74%).
- Theme (System / Light / Dark).
- **Class reminders** (dev build) + a "send a test reminder" button.
- **Background auto check-in** (dev build).
- **Backup & restore** to `.json`, reset / erase, and an About section.

## Marking model

Attendance uses a **check-in model** (honest and reliable), not silent background marking:
- Around class time you open the app (or tap a reminder) and hit **Check in**; it reads GPS, checks distance to the saved classroom, and marks you present (or *late* past the grace window).
- Manual marking and editing are always available.
- `Cancelled` and `Holiday` are excluded from the denominator; `Late` still counts as attended.

## Attendance math

- **Current %** = attended / held (cancelled & holidays excluded; late counts as present).
- **Must attend N** to reach target = smallest `n` where `(a+n)/(h+n) ≥ target`.
- **Can skip S now** = `floor(a/(target/100) − h)`.
- **End-of-term** uses the weekly timetable to count remaining classes, then projects the final %.
- Comparisons use the exact fraction; the **rounding rule** only affects the displayed number.
