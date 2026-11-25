# Notification sounds

Per TЗ, three distinct short cues must play when new items arrive in the activity feed:

| Notification type               | File name (iOS bundle + `android/app/src/main/res/raw/`) | Trigger                                         |
| ------------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| `search_request`                | `sound_search.mp3`                                       | A new sparring-search request is visible to you |
| `court_transfer`                | `sound_booking.mp3`                                      | A matching free-court offer appears             |
| `player_request`                | `sound_player_request.mp3`                               | Someone asks to be added to your preferred list |

## Placing the files

1. Drop the three `.mp3` (or `.wav`) files into:
   - `mobile/src/assets/sounds/` — referenced by Metro; ensure Metro picks up `.mp3` (default does)
   - `mobile/android/app/src/main/res/raw/` — required by `react-native-sound` on Android (lowercase, no hyphens)
   - For iOS, add the three files to the Xcode project under **Resources → Copy Bundle Resources** so they ship with the app bundle.

2. Keep files short (< 1 sec) and distinctive — the three must be recognizable by sound alone.

## Runtime

See `mobile/src/utils/sound.ts`. `playNotificationSound(type)` is a no-op if the file cannot be loaded, so the app still runs before sounds are added.
