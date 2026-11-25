import Sound from 'react-native-sound';

Sound.setCategory('Ambient', true);

export type NotificationSoundKey = 'search' | 'booking' | 'player_request';

const FILE_BY_KEY: Record<NotificationSoundKey, string> = {
  search: 'sound_search.mp3',
  booking: 'sound_booking.mp3',
  player_request: 'sound_player_request.mp3',
};

const cache: Partial<Record<NotificationSoundKey, Sound>> = {};

function load(key: NotificationSoundKey): Promise<Sound | null> {
  if (cache[key]) return Promise.resolve(cache[key]!);
  return new Promise(resolve => {
    const s = new Sound(FILE_BY_KEY[key], Sound.MAIN_BUNDLE, (error: unknown) => {
      if (error) {
        resolve(null);
        return;
      }
      cache[key] = s;
      resolve(s);
    });
  });
}

export async function playNotificationSound(key: NotificationSoundKey): Promise<void> {
  const s = await load(key);
  if (!s) return;
  s.stop(() => s.play());
}

const NOTIF_TYPE_TO_SOUND: Record<string, NotificationSoundKey> = {
  search_request: 'search',
  search_response: 'search',
  search_confirmed: 'search',
  court_transfer: 'booking',
  player_request: 'player_request',
};

export function soundKeyForNotificationType(type: string): NotificationSoundKey | null {
  return NOTIF_TYPE_TO_SOUND[type] ?? null;
}
