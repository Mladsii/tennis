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
import {GENDER_OPTIONS} from '../../constants/levels';
import {NativeDateField} from '../../components/common/NativeDateTimeField';

const STM_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function RegisterScreen({navigation}: any) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const register = useAuthStore(s => s.register);

  const [form, setForm] = useState({
    last_name: '',
    first_name: '',
    patronymic: '',
    date_of_birth: '',
    gender: 'M' as 'M' | 'F',
    nickname: '',
    phone_primary: '',
    city: '',
    years_playing: '0',
    stm_level: '5',
    ntrp_level: '3.0',
    password: '',
    password_confirm: '',
  });

  const updateForm = (key: string, value: string) =>
    setForm(prev => ({...prev, [key]: value}));

  const nextStep = () => {
    if (step === 1 && (!form.last_name || !form.first_name || !form.date_of_birth)) {
      Alert.alert('Ошибка', 'Заполните Фамилию, Имя и Дату рождения');
      return;
    }
    if (step === 2 && (!form.phone_primary || !form.password)) {
      Alert.alert('Ошибка', 'Заполните телефон и пароль');
      return;
    }
    if (step === 2 && form.password.length < 6) {
      Alert.alert('Ошибка', 'Пароль должен быть минимум 6 символов');
      return;
    }
    if (step === 2 && form.password !== form.password_confirm) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }
    setStep(s => s + 1);
  };

  // Convert DD.MM.YYYY to YYYY-MM-DD
  const formatDateForApi = (date: string): string => {
    const dotMatch = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dotMatch) {
      return `${dotMatch[3]}-${dotMatch[2]}-${dotMatch[1]}`;
    }
    return date; // already YYYY-MM-DD or other format
  };

  const handleRegister = async () => {
    if (!form.nickname) {
      Alert.alert('Ошибка', 'Укажите никнейм');
      return;
    }
    setLoading(true);
    try {
      await register({
        last_name: form.last_name,
        first_name: form.first_name,
        patronymic: form.patronymic || undefined,
        date_of_birth: formatDateForApi(form.date_of_birth),
        gender: form.gender,
        nickname: form.nickname,
        phone_primary: form.phone_primary,
        city: form.city || undefined,
        years_playing: parseInt(form.years_playing, 10) || 0,
        stm_level: form.stm_level,
        ntrp_level: form.ntrp_level,
        password: form.password,
      });
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      const status = e.response?.status;
      let message: string;
      if (Array.isArray(detail)) {
        message = detail.map((d: any) => d.msg || JSON.stringify(d)).join('\n');
      } else if (typeof detail === 'string') {
        message = detail;
      } else if (detail) {
        message = JSON.stringify(detail);
      } else {
        message = `Ошибка ${status ?? ''}: ${e.message ?? 'нет соединения'}`;
      }
      Alert.alert('Ошибка регистрации', message);
    } finally {
      setLoading(false);
    }
  };

  const NTRP_MAP: Record<string, string> = {
    '1': '1.0', '2': '1.5', '3': '2.0', '4': '2.5', '5': '3.0',
    '6': '3.5', '7': '4.0', '8': '4.5', '9': '5.0', '10': '5.5',
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Регистрация</Text>
        <Text style={styles.stepText}>Шаг {step} из 3</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {width: `${(step / 3) * 100}%`}]} />
        </View>

        {step === 1 && (
          <View style={styles.form}>
            <TextInput style={styles.input} placeholderTextColor={COLORS.textSecondary} placeholder="Фамилия *" value={form.last_name} onChangeText={v => updateForm('last_name', v)} />
            <TextInput style={styles.input} placeholderTextColor={COLORS.textSecondary} placeholder="Имя *" value={form.first_name} onChangeText={v => updateForm('first_name', v)} />
            <TextInput style={styles.input} placeholderTextColor={COLORS.textSecondary} placeholder="Отчество" value={form.patronymic} onChangeText={v => updateForm('patronymic', v)} />
            <NativeDateField
              label="Дата рождения *"
              value={
                form.date_of_birth
                  ? (() => {
                      const m = form.date_of_birth.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
                      return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date(2000, 0, 1);
                    })()
                  : new Date(2000, 0, 1)
              }
              maximumDate={new Date()}
              onChange={d => {
                const pad = (n: number) => String(n).padStart(2, '0');
                updateForm('date_of_birth', `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`);
              }}
            />
            <Text style={styles.label}>Пол</Text>
            <View style={styles.row}>
              {GENDER_OPTIONS.map(g => (
                <TouchableOpacity
                  key={g.value}
                  style={[styles.chip, form.gender === g.value && styles.chipActive]}
                  onPress={() => updateForm('gender', g.value)}>
                  <Text style={[styles.chipText, form.gender === g.value && styles.chipTextActive]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.form}>
            <TextInput style={styles.input} placeholderTextColor={COLORS.textSecondary} placeholder="Номер телефона *" value={form.phone_primary} onChangeText={v => updateForm('phone_primary', v)} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholderTextColor={COLORS.textSecondary} placeholder="Город" value={form.city} onChangeText={v => updateForm('city', v)} />
            <TextInput style={styles.input} placeholderTextColor={COLORS.textSecondary} placeholder="Пароль *" value={form.password} onChangeText={v => updateForm('password', v)} secureTextEntry />
            <TextInput style={styles.input} placeholderTextColor={COLORS.textSecondary} placeholder="Подтвердите пароль *" value={form.password_confirm} onChangeText={v => updateForm('password_confirm', v)} secureTextEntry />
          </View>
        )}

        {step === 3 && (
          <View style={styles.form}>
            <TextInput style={styles.input} placeholderTextColor={COLORS.textSecondary} placeholder="Никнейм (уникальный) *" value={form.nickname} onChangeText={v => updateForm('nickname', v)} autoCapitalize="none" />
            <TextInput style={styles.input} placeholderTextColor={COLORS.textSecondary} placeholder="Сколько лет играете" value={form.years_playing} onChangeText={v => updateForm('years_playing', v)} keyboardType="numeric" />
            <Text style={styles.label}>Ступень теннисного мастерства (СТМ)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stmRow}>
              {STM_OPTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.stmChip, form.stm_level === s && styles.chipActive]}
                  onPress={() => {
                    updateForm('stm_level', s);
                    updateForm('ntrp_level', NTRP_MAP[s] || '3.0');
                  }}>
                  <Text style={[styles.chipText, form.stm_level === s && styles.chipTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.hint}>NTRP: {NTRP_MAP[form.stm_level] || form.ntrp_level}</Text>
          </View>
        )}

        <View style={styles.buttons}>
          {step > 1 && (
            <TouchableOpacity style={styles.backButton} onPress={() => setStep(s => s - 1)}>
              <Text style={styles.backText}>Назад</Text>
            </TouchableOpacity>
          )}
          {step < 3 ? (
            <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
              <Text style={styles.nextText}>Далее</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextButton, loading && styles.disabled]}
              onPress={handleRegister}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color={COLORS.textLight} />
              ) : (
                <Text style={styles.nextText}>Зарегистрироваться</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Уже есть аккаунт? Войти</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  scroll: {flexGrow: 1, padding: SPACING.lg, paddingTop: SPACING.xl},
  title: {fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center'},
  stepText: {textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xs},
  progressBar: {height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginVertical: SPACING.md},
  progressFill: {height: 4, backgroundColor: COLORS.primary, borderRadius: 2},
  form: {marginBottom: SPACING.md},
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    marginBottom: SPACING.sm,
    color: COLORS.text,
  },
  label: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs, marginTop: SPACING.sm},
  hint: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs},
  row: {flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm},
  stmRow: {marginBottom: SPACING.sm},
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  chipText: {fontSize: FONT_SIZE.sm, color: COLORS.text},
  chipTextActive: {color: COLORS.textLight},
  stmChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  buttons: {flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg},
  backButton: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  backText: {color: COLORS.primary, fontSize: FONT_SIZE.md, fontWeight: '600'},
  nextButton: {
    flex: 2,
    padding: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  nextText: {color: COLORS.textLight, fontSize: FONT_SIZE.md, fontWeight: '600'},
  disabled: {opacity: 0.6},
  link: {color: COLORS.primary, textAlign: 'center', fontSize: FONT_SIZE.sm},
});
