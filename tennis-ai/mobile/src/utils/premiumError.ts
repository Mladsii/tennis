import {Alert} from 'react-native';

/**
 * If the API returned 403 with code PREMIUM_REQUIRED,
 * shows an alert prompting the user to upgrade.
 * Returns true if handled, false otherwise.
 */
export function handlePremiumError(
  error: any,
  navigation?: any,
): boolean {
  if (error?.response?.status === 403) {
    const detail = error.response.data?.detail;
    const code = typeof detail === 'object' ? detail?.code : null;
    if (code === 'PREMIUM_REQUIRED') {
      const message =
        typeof detail === 'object'
          ? detail.message
          : 'Эта функция доступна только с Premium-подпиской.';
      Alert.alert(
        '👑 Premium',
        message,
        [
          {text: 'Отмена', style: 'cancel'},
          navigation
            ? {
                text: 'Оформить Premium',
                onPress: () => navigation.navigate('Premium'),
              }
            : {text: 'OK'},
        ],
      );
      return true;
    }
  }
  return false;
}
