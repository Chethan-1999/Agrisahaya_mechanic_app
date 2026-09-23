import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications, type ActionPerformed, type PushNotificationSchema } from '@capacitor/push-notifications';

/**
 * Wraps FCM registration + local-notification tray management for both apps, Android-only
 * (every call is a no-op when Capacitor.isNativePlatform() is false, so the
 * app degrades gracefully in the Vite dev server / browser preview).
 *
 * NOT verified on a real device. Two things behave differently by how the
 * app was running when a push arrived:
 *  - Foreground: this code runs and reliably shows/cancels a tagged tray
 *    notification. Confident in this path.
 *  - Background/killed: Android shows the notification on its own from the
 *    push's `notification` block (reliable), but a silent dismiss push
 *    reaching this JS layer while backgrounded is NOT guaranteed under
 *    Capacitor's execution model — see the Blueprint §09 "validate before
 *    relying on it" note. If it doesn't fire, the stale notification just
 *    sits until the technician opens the app, where clearAllNotifications()
 *    below reliably cleans it up. Spike this on a real device before
 *    trusting the silent-cancel path in the field.
 */

const JOB_CHANNEL_ID = 'jobs';

// PushNotifications.register() hard-crashes the native app (uncatchable from JS) when
// android/app/google-services.json is missing. Opt in with VITE_ENABLE_PUSH=true only
// after that file is in place.
// That applies per native project: the admin app needs its own android-admin/app/google-services.json too.
const PUSH_ENABLED = import.meta.env.VITE_ENABLE_PUSH === 'true';

type RegisterToken = (fcmToken: string) => Promise<void>;

// The device's FCM token and who to hand it to. Listeners are added once per app launch; a later sign-in
// (e.g. logout → login as someone else) just swaps the callback and re-sends the token it already has.
let pushToken: string | null = null;
let registerToken: RegisterToken | null = null;
let listenersAdded = false;

/** Sets up push for the signed-in user; `register` sends the device's token to the backend (each app has its own call). */
export async function initNotifications(register: RegisterToken): Promise<void> {
  if (!Capacitor.isNativePlatform() || !PUSH_ENABLED) return;

  registerToken = register;

  if (listenersAdded) {
    if (pushToken) sendToken(pushToken);
    return;
  }
  listenersAdded = true;

  try {
    await registerNotifications();
  } catch (err) {
    console.warn('notification setup failed:', err);
  }
}

/** This device's FCM token, once registration has delivered one — used to unregister it on logout. */
export function currentPushToken(): string | null {
  return pushToken;
}

function sendToken(token: string): void {
  void registerToken?.(token).catch((err: unknown) => console.warn('failed to register push token:', err));
}

async function registerNotifications(): Promise<void> {
  await LocalNotifications.createChannel({
    id: JOB_CHANNEL_ID,
    name: 'Jobs',
    importance: 4,
  });

  // Android 13+ requires this separately from the push-registration permission below.
  await LocalNotifications.requestPermissions();

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', (token) => {
    pushToken = token.value;
    sendToken(token.value);
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.warn('push registration failed:', err);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    void handleForegroundPush(notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    void action; // tapping through to the specific job screen is a follow-up, not wired yet
  });

  // Clears the tray + badge every time the app comes back to the foreground — the WhatsApp behavior.
  await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void clearAllNotifications();
  });

  await clearAllNotifications();
}

async function handleForegroundPush(notification: PushNotificationSchema): Promise<void> {
  const jobId = notification.data?.jobId as string | undefined;
  const isDismiss = notification.data?.type === 'dismiss';

  if (isDismiss && jobId) {
    await LocalNotifications.cancel({ notifications: [{ id: notificationIdFor(jobId) }] });
    return;
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationIdFor(jobId ?? String(notification.id ?? Date.now())),
        title: notification.title ?? 'AgriSahaya',
        body: notification.body ?? '',
        channelId: JOB_CHANNEL_ID,
        extra: { jobId },
      },
    ],
  });
}

/** Clears every AgriSahaya notification and resets the badge. Called on app open/resume. */
export async function clearAllNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
}

/** Stable positive 32-bit id derived from a job id, so the same job always maps to the same local-notification id. */
function notificationIdFor(jobId: string): number {
  let hash = 0;
  for (let i = 0; i < jobId.length; i += 1) {
    hash = (hash * 31 + jobId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}
