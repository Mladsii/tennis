import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {usersApi} from '../../api/users';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage} from '../../utils/format';

const NTRP_OPTIONS = [
  {label: 'Начинающий', value: 'beginner'},
  {label: 'Любитель', value: 'intermediate'},
  {label: 'Продвинутый', value: 'advanced'},
  {label: 'Профессионал', value: 'professional'},
];

const STM_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function EditProfileScreen({navigation}: any) {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const [loading, setLoading] = useState(false);

  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [patronymic, setPatronymic] = useState(user?.patronymic ?? '');
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [yearsPlaying, setYearsPlaying] = useState(String(user?.years_playing ?? 0));
  const [ntrpLevel, setNtrpLevel] = useState(user?.ntrp_level ?? 'beginner');
  const [stmLevel, setStmLevel] = useState(user?.stm_level ?? '3');
  const [phoneSecondary, setPhoneSecondary] = useState(user?.phone_secondary ?? '');

  const handleSave = async () => {
    if (!lastName.trim() || !firstName.trim()) {
      Alert.alert('Ошибка', 'Имя и фамилия обязательны');
      return;
    }
    setLoading(true);
    try {
      const {data} = await usersApi.updateMe({
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        patronymic: patronymic.trim() || null,
        nickname: nickname.trim(),
        city: city.trim() || null,
        address: address.trim() || null,
        years_playing: parseInt(yearsPlaying, 10) || 0,
        ntrp_level: ntrpLevel,
        stm_level: stmLevel,
        phone_secondary: phoneSecondary.trim() || null,
      } as any);
      setUser(data);
      Alert.alert('Сохранено', 'Профиль обновлён');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось сохранить'));
    } finally {
      setLoading(false);
    }
  };

  const Field = ({
    label,
    value,
    onChange,
    keyboardType = 'default',
    placeholder = '',
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    keyboardType?: any;
    placeholder?: string;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Редактировать профиль</Text>

      <Field label="Фамилия *" value={lastName} onChange={setLastName} />
      <Field label="Имя *" value={firstName} onChange={setFirstName} />
      <Field label="Отчество" value={patronymic} onChange={setPatronymic} placeholder="Необязательно" />
      <Field label="Никнейм" value={nickname} onChange={setNickname} placeholder="@username" />
      <Field label="Город" value={city} onChange={setCity} />
      <Field label="Адрес" value={address} onChange={setAddress} />
      <Field label="Лет играю в теннис" value={yearsPlaying} onChange={setYearsPlaying} keyboardType="numeric" />
      <Field label="Доп. телефон" value={phoneSecondary} onChange={setPhoneSecondary} keyboardType="phone-pad" />

      {/* NTRP */}
      <Text style={styles.label}>Уровень NTRP</Text>
      <View style={styles.chipRow}>
        {NTRP_OPTIONS.map(o => (
          <TouchableOpacity
            key={o.value}
            style={[styles.chip, ntrpLevel === o.value && styles.chipActive]}
            onPress={() => setNtrpLevel(o.value)}>
            <Text style={[styles.chipText, ntrpLevel === o.value && styles.chipTextActive]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* STM */}
      <Text style={styles.label}>СТМ уровень</Text>
      <View style={styles.chipRow}>
        {STM_OPTIONS.map(v => (
          <TouchableOpacity
            key={v}
            style={[styles.stmChip, stmLevel === v && styles.chipActive]}
            onPress={() => setStmLevel(v)}>
            <Text style={[styles.chipText, stmLevel === v && styles.chipTextActive]}>
              {v}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.disabled]}
        onPress={handleSave}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color={COLORS.textLight} />
        ) : (
          <Text style={styles.buttonText}>Сохранить</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md, paddingBottom: 40},
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  fieldGroup: {marginBottom: SPACING.sm},
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  stmChip: {
    width: 40,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  chipActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  chipText: {fontSize: FONT_SIZE.sm, color: COLORS.text},
  chipTextActive: {color: COLORS.textLight},
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  disabled: {opacity: 0.6},
  buttonText: {color: COLORS.textLight, fontSize: FONT_SIZE.lg, fontWeight: '600'},
});
