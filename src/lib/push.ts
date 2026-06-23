import { Capacitor } from '@capacitor/core';
import { saveDeviceToken } from './api';

// Register the device for FCM push notifications and store its token so the
// send-push Edge Function can deliver to it. No-op on web / when permission is
// denied. Safe to call once the user is signed in.
export async function initPush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    // Ensure the channel referenced by send-push exists (required on Android 8+
    // or killed-app pushes won't render). Ignore failures (iOS / older Android).
    try {
      await PushNotifications.createChannel({
        id: 'attendly_default',
        name: 'Attendly',
        description: 'Leave, attendance and announcement alerts',
        importance: 5,
        visibility: 1,
      });
    } catch { /* not Android */ }

    // When the FCM token arrives (or rotates), persist it for this user.
    await PushNotifications.removeAllListeners();
    await PushNotifications.addListener('registration', (token) => {
      void saveDeviceToken(token.value, Capacitor.getPlatform());
    });
    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('Push registration error', err);
    });

    await PushNotifications.register();
  } catch (e) {
    console.warn('Push init failed', e);
  }
}
