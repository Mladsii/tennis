import Sound from 'react-native-sound';
import {Platform} from 'react-native';

// Preload sounds on module load
Sound.setCategory('Ambient', true);

type SoundKey = 'search' | 'booking' | 'player';

const SOUND_FILES: Record<SoundKey, string> = {
  search: 'sound_search.wav',
  booking: 'sound_booking.wav',
  player: 'sound_player.wav',
};

const sounds: Partial<Record<SoundKey, Sound>> = {};

// Preload all sounds
Object.entries(SOUND_FILES).forEach(([key, file]) => {
  const sound = new Sound(file, Sound.MAIN_BUNDLE, error => {
    if (error) {
      console.log(`Failed to load sound ${file}:`, error);
    }
  });
  sounds[key as SoundKey] = sound;
});

export function playSound(key: SoundKey): void {
  const sound = sounds[key];
  if (!sound) return;
  sound.stop(() => {
    sound.play(success => {
      if (!success) {
        console.log(`Sound ${key} playback failed`);
      }
    });
  });
}

// Specific helpers
export const playSoundSearch = () => playSound('search');   // новый поиск партнёра
export const playSoundBooking = () => playSound('booking');  // бронирование корта
export const playSoundPlayer = () => playSound('player');    // добавление игрока
