# Features

## Terms (semesters)

- Each term (for example "Sem 1", "Sem 2") keeps its **own subjects, timetable, attendance and streak**. Nothing mixes between terms.
- **Settings > Term** shows the viewed term (name and dates) and **All terms**, where you switch terms or **start a new term** (name, dates, and optionally copy the current timetable as a starting point; attendance always starts from zero).
- Past terms stay viewable and editable. New classes are only created for the term running today; terms can't overlap.
- A banner says when you're viewing a past or upcoming term, or when the current term has ended.
- Data from before terms existed becomes "Term 1" automatically.

## Screens

### Today
- **Verdict banner**: a plain-language answer up top ("You're safe, skip 4 more" / "Below 75%, attend the next N").
- **Attendance ring** with the target marked as a notch, coloured by zone (safe / cutting it close / needs attention / building).
- **Streak** card (current and best).
- **Today's classes**: each row is swipeable (right = present, left = absent), has a one-tap **Check in** (GPS) and a `•••` menu (Present / Late / Absent / No class held / Holiday / Clear / **Change subject**).
- **Catch-up card**: past classes you never marked, with quick Present / Absent / Not held / Change subject buttons, so your % is never silently wrong.
- **Worst-first subject bars** with the target line; long names wrap, the status chip sits under the bar.

### Stats
- **Cumulative trend** line with the target line and a since-start delta.
- **Activity heatmap**: a month grid coloured Present / Absent / Partial / No class. Spans the current term when term dates are set, else the last 6 months.
- **Subject bars** for every active subject.

### Bunk calculator
- Pick **Overall** or a subject, and get **one answer**: "Skip 5" or "Attend 3", using that subject's own target and your rounding rule.
- **What if I miss N**: a stepper that shows the resulting %.
- **End-of-term projection**: attend all gives X%, skip all gives Y%, how many of the remaining you can still miss, and an honest "not reachable this term" warning.
- **Tightest subject** line: tap to focus it.

### Timetable
- Weekly day picker; add / edit / delete subjects and classes (deletes ask first; removing a class keeps its marked history).
- **Time picker**: a scrollable HH:MM wheel (pure JS).
- **Copy a day**: duplicate one day's classes onto other days.
- **Set the classroom on a map**: pan a real map (Leaflet + OpenStreetMap) under a fixed pin, pick a radius.
- **Calendar**: tap any date to open its day sheet (below). Future dates show the planned classes.

### Day sheet (from the calendar)
- Mark each class Present / Late / Absent / Not held.
- **Change subject**: the class that actually ran counts; the timetabled subject is frozen for that date. Picking it again restores the class.
- **Extra class** (not in the timetable) and **Whole day holiday**.

### Settings
- Target %, count-cancelled toggle, per-subject targets.
- **Term**: name, start and end of the viewed term (date dial), and the list of all terms.
- **Check-in**: default radius, grace period (after which a check-in counts as Late).
- **Rounding rule**: round or truncate (for colleges that truncate 74.6% to 74%).
- Theme (System / Light / Dark).
- **Class reminders** and **background auto check-in** (dev or release build).
- **Backup and restore**: share a `.json` backup; restore checks the file, previews it and asks first.
- **Automatic backups** (phone): one per day, last 7 kept, restore any of them; optional Android backup folder that survives uninstalling.
- **Your data**: undo the last restore / reset / erase / cloud download, reset to sample data, erase.
- **Account and sync** (optional): see below.

### Account and sync (optional)
- Create an account with email and password (8+ characters with a number). Sync starts once the email is verified.
- **Continue with Google** (installed app and web; hidden in Expo Go). A Google login with the same email as a password account is linked, not duplicated.
- Forgot password, resend verification, sign out, and **delete account and cloud data** (asks for the password or Google again).
- Sync runs after sign-in, a few seconds after changes, and when leaving or returning to the app. If the phone and the cloud both changed the same data, you choose which to keep.
- **Sync class locations** can be turned off to keep building coordinates on the phone only.

## Marking model

Attendance uses a **check-in model** (honest and reliable), not silent background marking:
- Around class time you open the app (or tap a reminder) and hit **Check in**; it reads GPS, checks the distance to the saved classroom, and marks you present (or late past the grace window).
- Manual marking and editing are always available, including any past date from the calendar.
- `Not held` (cancelled) and `Holiday` are excluded from the denominator; `Late` still counts as attended.

## Attendance math

- **Current %** = attended / held (cancelled and holidays excluded; late counts as present).
- **Must attend N** to reach target = smallest `n` where `(a+n)/(h+n) >= target`.
- **Can skip S now** = `floor(a/(target/100) - h)`.
- **End-of-term** uses the weekly timetable to count remaining classes, then projects the final %.
- Comparisons use the exact fraction; the **rounding rule** only affects the displayed number.
- A swapped class counts only for the subject that actually ran.
