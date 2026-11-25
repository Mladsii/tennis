import {Platform, Alert} from 'react-native';
import {playSound} from './sounds';
import api from '../api/client';

export type NotificationType = 'search' | 'booking' | 'player_request' | 'match' | 'trainer';

const SOUND_MAP: Partial<Record<NotificationType, () => void>> = {
  search: () => playSound('search'),
  booking: () => playSound('booking'),
  player_request: () => playSound('player'),
};

// Проверяем доступен ли Firebase (требует google-services.json)
function isFirebaseAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const app = require('@react-native-firebase/app').default;
    return app.apps.length > 0;
  } catch {
    return false;
  }
}

/** Получить FCM-токен и отправить на бекенд */
export async function registerFCMToken(): Promise<void> {
  if (!isFirebaseAvailable()) {
    console.log('FCM: Firebase not configured (google-services.json missing)');
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messaging = require('@react-native-firebase/messaging').default;
    const authStatus = await messaging().requestPermission();
    const granted =
      authStatus === 1 || // AUTHORIZED
      authStatus === 2;   // PROVISIONAL
    if (!granted) return;

    const token = await messaging().getToken();
    if (!token) return;

    await api.post('/device-tokens', {token, platform: Platform.OS});
    console.log('FCM token registered');
  } catch (e) {
    console.log('FCM register error:', e);
  }
}

/** Подписаться на foreground push */
export function subscribeForegroundPush(): () => void {
  if (!isFirebaseAvailable()) {
    return () => {};
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messaging = require('@react-native-firebase/messaging').default;
    return messaging().onMessage(async (remoteMessage: any) => {
      const type = remoteMessage.data?.type as NotificationType | undefined;
      if (type && SOUND_MAP[type]) {
        SOUND_MAP[type]!();
      }
      const title = remoteMessage.notification?.title ?? 'TennisAI';
      const body = remoteMessage.notification?.body ?? '';
      if (body) Alert.alert(title, body);
    });
  } catch {
    return () => {};
  }
}
