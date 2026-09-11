# AgriSahaya — User Guide

How the app works day-to-day, for technicians and admins. For setup/running the
project, see [README.md](README.md).

The app has two sides, reached from the same landing screen:

- **Technician Login / Technician Sign Up** — for repair technicians
- **Admin Login** (top corner) — for the admin managing them

A language switcher (English, Hindi, Kannada, Tamil, Telugu, Malayalam) sits on
the landing screen and carries through the whole technician-facing app. The
admin console stays in English.

## For technicians

### Signing up

1. From the landing screen, choose **Technician Sign Up**.
2. Enter your mobile number and tap **Send OTP**. You'll get a code by SMS.
   (Only when testing locally against the Firebase emulator does the app show
   the code directly on screen instead of sending an SMS — see the README's
   "Local vs. production OTP" section. In the real app it's always a real SMS.)
3. Enter the code and tap **Verify**.
4. Fill in your profile: full name, village, district, state, pincode,
   address, a landmark (optional), age, and years of experience.
5. Tap **Submit**.

Your account now shows **Account pending approval** — you'll be notified in
the app once an admin verifies your details. If you need help before then, the
support number shown on screen is tap-to-call.

If an admin rejects the signup or later deactivates the account, this same
screen shows **Account not approved** or **Account deactivated** instead, with
the reason and the support number to call.

### Logging in

From the landing screen, choose **Technician Login**, enter your mobile
number, request a code, enter it, and tap **Login**. If your account isn't
approved yet you'll land on the pending screen above instead of the dashboard.

On a device with fingerprint/face unlock or a screen lock set up, the app may
ask you to unlock with it before showing your session — this is a device-level
lock on top of an already-signed-in session, not a second password to
remember. If it doesn't recognize you, tap **Try Again**.

### Dashboard

Shows your name and profile details, the support number, and three actions:
**Jobs**, **Profile**, **Request Change**, plus **Logout**.

### Jobs

The Jobs list shows every job assigned to you, in the order they were
created, numbered **Task 1**, **Task 2**, and so on. Each row shows the task
number, the job description, the farmer's name, and a status pill.

- **Open jobs (assigned to you, or already accepted)** are tappable — opening
  one shows the full detail: description, farmer name, farmer's phone number
  (tap to call), and status, with action buttons:
  - **Accept** / **Decline** — while the job is newly assigned to you.
    Declining asks you to confirm; the admin then reassigns it to someone
    else.
  - **Mark Complete** — once you've accepted it.
- **Completed, cancelled, or declined jobs** are shown in the list but are no
  longer tappable — you still see the task number, description, farmer name,
  and status, but the full detail (farmer phone, etc.) is no longer shown,
  since there's nothing left to act on.

You'll get a notification when a job is assigned to you, and if that job is
later cancelled or reassigned before you act on it, the notification for it is
cleared automatically. Opening the app also clears your whole notification
tray.

### Requesting a profile change

Your phone number can't be self-edited (it's tied to your login), but every
other field can. From the dashboard, choose **Request Change**:

1. Edit whichever fields need updating.
2. Explain why in the **Reason for this change** box — this is required.
3. Tap **Submit Request**.

Nothing changes immediately — an admin reviews the request and approves or
rejects it. You're notified in the app either way (rejections include the
admin's note, if they left one). You must change at least one field to
submit.

## For admins

Log in from **Admin Login** on the landing screen with the email/password an
admin account was created with (see the README's "Bootstrap the first admin"
section — there's no self-service admin signup).

The admin console has five sections in the side/top nav:

### Dashboard

Totals for active, inactive, and pending technicians.

### Mechanics (technician roster)

A searchable, filterable list of every technician (by district, village,
status). For each technician you can:

- **Approve or reject** a pending signup
- **Activate / deactivate** an existing technician
- **View** full details, including their running job stats (completed,
  cancelled, pending)
- **Edit** their record directly (as opposed to a technician's own
  request-and-approve flow)

### Jobs (Job Board)

- **New Job** — log a job with the farmer's name, phone, and a description,
  optionally assigning it to an active technician right away, or leaving it
  unassigned to assign later.
- Each row shows the job, farmer, assigned technician, status, and when it was
  logged.
- **Assign / Reassign** — for any job that's open or was declined, pick a
  technician from the dropdown and tap **Assign**.
- **Cancel** — available for open, assigned, or accepted jobs. You'll be asked
  for an optional reason. **Only admins can cancel a job** — technicians can
  accept, decline, or complete, but never cancel.

### Profile Requests

Every pending profile-change request from technicians, showing what they want
changed, their stated reason, and:

- **Approve** — applies the change immediately.
- **Reject** — leave a note (shown to the technician) explaining why, then
  reject.

### Settings

Light/dark mode toggle.

## Known caveats

- Push notification reliability while the app is backgrounded or fully closed
  hasn't been verified on a real device yet — see the README's "Known gaps".
  If a "your job was cancelled" notification doesn't clear itself in the
  background, it will clear the next time the app is opened.
- The fingerprint/face unlock step also hasn't been verified on a real device
  yet. If it misbehaves, logging out and back in bypasses it.
- Kannada, Tamil, Telugu, and Malayalam translations are a first pass and
  haven't been checked by a native speaker yet — if something reads oddly in
  one of those languages, switch to English or Hindi (both verified) and let
  the team know which screen/string looked wrong.
