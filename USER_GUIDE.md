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
the reason and the support number to call. A rejected signup shows an
**Apply again** button: your details are already filled in (and kept on your
phone), so fix whatever was wrong and send it again — as many times as you need.

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

Shows your name and profile details, the support number, and two actions:
**Jobs**, **Profile**, plus **Logout**.

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

### Editing your profile

Your phone number can't be edited (it's tied to your login), but every other
field can. On the **Profile** tab, tap **Edit profile**, change what you need,
and tap **Save profile** — the change is live at once, no admin approval
needed. Every change is kept as a new version of your profile, so an admin can
see what changed and when. Whether your payment is verified is set only by an
admin.

### Referring farmers

Sign farmers up for the **AgriSahaya Annual Service Plan** from the **Farmers**
tab. Tap **Add farmer** and fill in the farmer's name, mobile number, village,
mandal/district, pincode, state, and the machinery they own (tick **Other** to
type in a machine that isn't listed). Tap **Submit** and the request goes to
the admin.

The Farmers tab lists everyone you've referred with its status:
**Waiting for approval**, **Subscribed** (with the plan's start and end dates),
or **Not approved** (with the admin's reason). A farmer can have only one open
or active request, so a number that's already waiting or subscribed can't be
sent again. Payment is arranged with the farmer separately, after the admin has
verified the request — it isn't collected in the app.

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

- **Approve** a pending signup
- **Activate / deactivate** an existing technician
- **View** full details, including their running job stats (completed,
  cancelled, pending)
- **Edit** their record directly (as opposed to a technician's own
  request-and-approve flow)

### Add new jobs

- **Add job** — log a job with the customer's name, a 10-digit phone number,
  equipment, issue, district and optional notes. Each job gets an ID like
  `#26091901` (date + daily sequence).
- **Edit** any job that isn't completed or cancelled (a technician holding it is
  told the details changed). **Delete** only a declined, cancelled or completed
  job — cancel a live job first. A deleted job leaves the boards but is kept on
  record and counted as deleted for the admin and the technician.
- Pending jobs (open, declined, assigned, accepted) sit at the top of both job
  boards; completed jobs follow, cancelled ones last.

### Assign jobs

- Pick an active technician from the dropdown and tap **Save**. A job that's
  open or was declined can be assigned directly; a job already held by a
  technician is unlocked with **Edit** and **reassigned** (the new technician
  must accept it again, and the previous one is told it was reassigned).
- Deactivating a technician takes back every job they hold. Those jobs go back
  to open with a light-red frame and "reassign" label until you assign them
  again (they then show as reassigned); the technician is told.
- Tick **Completed** to assign and close a job in one step, or to close a job
  the technician already holds; the technician is told it was completed.
- **Cancel job** — available until a job is completed or cancelled. **Only
  admins can cancel a job** — technicians can accept, decline, or complete,
  but never cancel.

### Farmer subscriptions

Subscription requests that mechanics sent for the farmers they referred, one
card per farmer, newest first. Filter by **Pending** (the default),
**Approved**, **Rejected**, or **All**; tap **More** for the phone number (tap
to call and verify), pincode, state, machinery, and the referring mechanic's
number.

- **Approve Subscription** confirms the request is genuine. The farmer's plan
  starts that day (India time) and runs 12 months (the `subscriptionPlanMonths`
  setting). A welcome SMS with the plan dates and what it covers is prepared,
  and the mechanic gets a push saying the farmer is subscribed.
- **Reject** asks for an optional reason, which the mechanic sees.
- The SMS provider isn't connected yet, so an approved card says so and offers
  **Send SMS from this phone**: it opens your phone's messaging app with the
  farmer's number and the message already filled in. Once a provider is
  connected, **Resend SMS** sends it from the server.

### Community

Post a title and message that every active technician sees in the app's
Community tab (and receives as a push notification).

### Profile history

A mechanic's detail page lists every version of their profile, newest first:
the signup (v1), then each change — by the mechanic, by an admin, or a re-sent
signup — with the old and new value of every field that changed.

## Known caveats

- Push notification reliability while the app is backgrounded or fully closed
  hasn't been verified on a real device yet — see the README's "Known gaps".
  If a "your job was cancelled" notification doesn't clear itself in the
  background, it will clear the next time the app is opened.
- Kannada, Tamil, Telugu, and Malayalam translations are a first pass and
  haven't been checked by a native speaker yet — if something reads oddly in
  one of those languages, switch to English or Hindi (both verified) and let
  the team know which screen/string looked wrong.
- The farmer confirmation SMS isn't sent automatically yet — no SMS provider is
  connected. Admins send it with **Send SMS from this phone** on the approved
  card.
