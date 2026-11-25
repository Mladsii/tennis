import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';

export default function LoginScreen({navigation}: any) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore(s => s.login);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }
    setLoading(true);
    try {
      await login(phone, password);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      let message: string;
      if (detail) {
        message = Array.isArray(detail)
          ? detail.map((d: any) => d.msg || d).join('\n')
          : typeof detail === 'string'
            ? detail
            : 'Неверный телефон или пароль';
      } else if (e.code === 'ECONNABORTED') {
        message = 'Сервер не отвечает (таймаут)';
      } else if (e.message?.includes('Network Error')) {
        message = `Нет подключения к серверу: ${e.message}`;
      } else {
        message = `Ошибка: ${e.message || 'Неверный телефон или пароль'}`;
      }
      Alert.alert('Ошибка входа', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.logo}>🎾</Text>
        <Text style={styles.title}>Tennis Partner</Text>
        <Text style={styles.subtitle}>Поиск спарринг-партнера</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Номер телефона"
            placeholderTextColor={COLORS.textSecondary}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Пароль"
            placeholderTextColor={COLORS.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={COLORS.textLight} />
            ) : (
              <Text style={styles.buttonText}>Войти</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.link}>Нет аккаунта? Зарегистрироваться</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  logo: {fontSize: 64, textAlign: 'center', marginBottom: SPACING.sm},
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },
  form: {marginBottom: SPACING.lg},
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    marginBottom: SPACING.md,
    color: COLORS.text,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {opacity: 0.6},
  buttonText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
  },
  link: {
    color: COLORS.primary,
    textAlign: 'center',
    fontSize: FONT_SIZE.md,
  },
});
