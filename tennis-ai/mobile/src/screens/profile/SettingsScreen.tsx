import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import {usersApi} from '../../api/users';
import {UserSettings} from '../../types/user';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {GAME_TYPES, GENDER_OPTIONS} from '../../constants/levels';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usersApi.getSettings().then(({data}) => setSettings(data)).catch(() => {});
  }, []);

  const update = (key: keyof UserSettings, value: any) => {
    if (settings) setSettings({...settings, [key]: value});
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await usersApi.updateSettings(settings);
      Alert.alert('Сохранено', 'Настройки обновлены');
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Настройки</Text>

      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Text style={styles.label}>Активный поиск игроков</Text>
          <Text style={styles.hint}>Принимать сообщения от потенциальных партнеров</Text>
        </View>
        <Switch
          value={settings.is_active_search}
          onValueChange={v => update('is_active_search', v)}
          trackColor={{true: COLORS.primaryLight}}
        />
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Text style={styles.label}>Принимать другие запросы</Text>
          <Text style={styles.hint}>Предложения кортов, запросы в друзья</Text>
        </View>
        <Switch
          value={settings.accept_other_requests}
          onValueChange={v => update('accept_other_requests', v)}
          trackColor={{true: COLORS.primaryLight}}
        />
      </View>

      <Text style={styles.sectionTitle}>Звуковые уведомления</Text>

      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Text style={styles.label}>Звук при поиске партнёра</Text>
          <Text style={styles.hint}>Появился подходящий запрос на спарринг</Text>
        </View>
        <Switch
          value={settings.sound_on_search}
          onValueChange={v => update('sound_on_search', v)}
          trackColor={{true: COLORS.primaryLight}}
        />
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Text style={styles.label}>Звук при свободной брони</Text>
          <Text style={styles.hint}>Кто-то передаёт корт в подходящей локации</Text>
        </View>
        <Switch
          value={settings.sound_on_booking}
          onValueChange={v => update('sound_on_booking', v)}
          trackColor={{true: COLORS.primaryLight}}
        />
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Text style={styles.label}>Звук при запросе в друзья</Text>
          <Text style={styles.hint}>Другой игрок хочет добавить вас в свой список</Text>
        </View>
        <Switch
          value={settings.sound_on_player_request}
          onValueChange={v => update('sound_on_player_request', v)}
          trackColor={{true: COLORS.primaryLight}}
        />
      </View>

      <Text style={styles.sectionTitle}>Фильтры входящих запросов</Text>

      <Text style={styles.label}>Пол партнера</Text>
      <View style={styles.row}>
        {[{value: null, label: 'Любой'}, ...GENDER_OPTIONS].map(g => (
          <TouchableOpacity
            key={String(g.value)}
            style={[styles.chip, settings.filter_gender === g.value && styles.chipActive]}
            onPress={() => update('filter_gender', g.value)}>
            <Text style={[styles.chipText, settings.filter_gender === g.value && styles.chipTextActive]}>
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Тип игры</Text>
      <View style={styles.row}>
        {[{value: null, label: 'Любая'}, ...GAME_TYPES].map(gt => (
          <TouchableOpacity
            key={String(gt.value)}
            style={[styles.chip, settings.filter_game_type === gt.value && styles.chipActive]}
            onPress={() => update('filter_game_type', gt.value)}>
            <Text style={[styles.chipText, settings.filter_game_type === gt.value && styles.chipTextActive]}>
              {gt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Диапазон СТМ партнера</Text>
      <View style={styles.rangeRow}>
        <TextInput
          style={styles.rangeInput}
          placeholderTextColor={COLORS.textSecondary}
          placeholder="От"
          value={settings.filter_stm_min?.toString() || ''}
          onChangeText={v => update('filter_stm_min', v ? parseInt(v, 10) : null)}
          keyboardType="numeric"
        />
        <Text style={styles.rangeSep}>—</Text>
        <TextInput
          style={styles.rangeInput}
          placeholderTextColor={COLORS.textSecondary}
          placeholder="До"
          value={settings.filter_stm_max?.toString() || ''}
          onChangeText={v => update('filter_stm_max', v ? parseInt(v, 10) : null)}
          keyboardType="numeric"
        />
      </View>

      <Text style={styles.label}>Возрастной диапазон (лет)</Text>
      <View style={styles.rangeRow}>
        <TextInput
          style={styles.rangeInput}
          placeholderTextColor={COLORS.textSecondary}
          placeholder="От"
          value={settings.filter_age_min?.toString() || ''}
          onChangeText={v => update('filter_age_min', v ? parseInt(v, 10) : null)}
          keyboardType="numeric"
        />
        <Text style={styles.rangeSep}>—</Text>
        <TextInput
          style={styles.rangeInput}
          placeholderTextColor={COLORS.textSecondary}
          placeholder="До"
          value={settings.filter_age_max?.toString() || ''}
          onChangeText={v => update('filter_age_max', v ? parseInt(v, 10) : null)}
          keyboardType="numeric"
        />
      </View>

      <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={save} disabled={saving}>
        <Text style={styles.saveBtnText}>Сохранить настройки</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md, paddingBottom: SPACING.xl},
  title: {fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.primary, marginBottom: SPACING.md},
  sectionTitle: {fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text, marginTop: SPACING.lg, marginBottom: SPACING.sm},
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  switchLabel: {flex: 1, marginRight: SPACING.md},
  label: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs, marginTop: SPACING.sm},
  hint: {fontSize: FONT_SIZE.xs, color: COLORS.disabled},
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm},
  chip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  chipActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  chipText: {fontSize: FONT_SIZE.sm, color: COLORS.text},
  chipTextActive: {color: COLORS.textLight},
  rangeRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm},
  rangeInput: {
    flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: SPACING.md, fontSize: FONT_SIZE.md, textAlign: 'center',
    color: COLORS.text,
  },
  rangeSep: {fontSize: FONT_SIZE.lg, color: COLORS.textSecondary},
  saveBtn: {
    backgroundColor: COLORS.primary, padding: SPACING.md,
    borderRadius: 12, alignItems: 'center', marginTop: SPACING.lg,
  },
  disabled: {opacity: 0.6},
  saveBtnText: {color: COLORS.textLight, fontSize: FONT_SIZE.md, fontWeight: '600'},
});
