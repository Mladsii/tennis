import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer, DefaultTheme, DarkTheme} from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import {useAuthStore} from './src/store/authStore';
import {registerFCMToken, subscribeForegroundPush} from './src/utils/fcm';
import {COLORS, IS_DARK_THEME} from './src/constants/theme';

const navTheme = {
  ...(IS_DARK_THEME ? DarkTheme : DefaultTheme),
  colors: {
    ...(IS_DARK_THEME ? DarkTheme.colors : DefaultTheme.colors),
    primary: COLORS.primary,
    background: COLORS.background,
    card: COLORS.surface,
    text: COLORS.text,
    border: COLORS.border,
  },
};

export default function App() {
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (!user) return;
    // Регистрируем FCM-токен когда пользователь вошёл
    registerFCMToken().catch(() => {});
    // Подписываемся на foreground push
    const unsubscribe = subscribeForegroundPush();
    return unsubscribe;
  }, [user?.id]);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar
          barStyle={IS_DARK_THEME ? 'light-content' : 'dark-content'}
          backgroundColor={COLORS.background}
        />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
