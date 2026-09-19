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

1. From the landing screen, choose **Technician Sign Up** (or **Technician
   Login** — both lead to the same phone-verification screen).
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

There's no separate login step or password to remember. The first time you
verify your phone number, the app keeps you signed in on that device — closing
and reopening the app takes you straight to your dashboard (or the pending
screen, if you're not approved yet) with no prompt. If you ever end up signed
out (a new device, or app data cleared), verifying your phone number again
with a fresh OTP code signs you straight back into your existing account — no
profile form to refill.

Signing in on a new phone signs you out of any other phone that was signed in
— only one device can be active on your account at a time.

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

You can only submit a limited number of change requests in total (2 by
default) — the screen shows how many you've used. Once you've used them all,
contact your admin directly for any further changes.

## For admins

Log in from **Admin Login** on the landing screen with the email/password an
admin account was created with (see the README's "Bootstrap the first admin"
section — there's no self-service admin signup).

The admin console has these sections in the side/top nav:

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

### Add new jobs

- **Add job** — log a job with the customer's name, a 10-digit phone number,
  equipment, issue, district and optional notes. Each job gets an ID like
  `#26091901` (date + daily sequence).
- **Edit** any job that isn't completed or cancelled; **Delete** any job that
  isn't completed (a technician holding it is released and notified).

### Assign jobs

- Pick an active technician from the dropdown and tap **Save**. A job that's
  open or was declined can be assigned directly; a job already held by a
  technician is unlocked with **Edit** and **reassigned** (the new technician
  must accept it again, and the previous one's job is withdrawn).
- Tick **Completed** to close a job on the technician's behalf.
- **Cancel job** — available until a job is completed or cancelled. **Only
  admins can cancel a job** — technicians can accept, decline, or complete,
  but never cancel.

### Community

Post a title and message that every active technician sees in the app's
Community tab (and receives as a push notification).

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
- Kannada, Tamil, Telugu, and Malayalam translations are a first pass and
  haven't been checked by a native speaker yet — if something reads oddly in
  one of those languages, switch to English or Hindi (both verified) and let
  the team know which screen/string looked wrong.
