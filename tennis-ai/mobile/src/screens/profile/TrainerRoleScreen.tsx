import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import {trainerRoleApi, TrainerApplication} from '../../api/trainerRole';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage} from '../../utils/format';

const STATUS_LABELS: Record<string, string> = {
  none: 'Не подавали заявку',
  pending: 'Заявка на рассмотрении',
  approved: 'Подтверждён как тренер ✓',
  rejected: 'Заявка отклонена',
};

const STATUS_COLOR: Record<string, string> = {
  none: COLORS.textSecondary,
  pending: COLORS.warning,
  approved: COLORS.success,
  rejected: COLORS.error,
};

export default function TrainerRoleScreen() {
  const [app, setApp] = useState<TrainerApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [skills, setSkills] = useState('');
  const [education, setEducation] = useState('');
  const [achievements, setAchievements] = useState('');
  const [individual, setIndividual] = useState(true);
  const [group, setGroup] = useState(false);
  const [kids, setKids] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const load = useCallback(async () => {
    try {
      const {data} = await trainerRoleApi.me();
      setApp(data);
      setSkills(data.trainer_skills ?? '');
      setEducation(data.trainer_education ?? '');
      setAchievements(data.trainer_achievements ?? '');
      setIndividual(data.trainer_individual);
      setGroup(data.trainer_group);
      setKids(data.trainer_kids);
      setDisabled(data.trainer_disabled);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !app) {
    return <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />;
  }

  const submit = async () => {
    if (!skills.trim()) return Alert.alert('Ошибка', 'Опишите ваши навыки');
    setBusy(true);
    try {
      await trainerRoleApi.apply({
        skills: skills.trim(),
        education: education || null,
        achievements: achievements || null,
        individual,
        group,
        kids,
        disabled,
      });
      Alert.alert('Готово', 'Заявка отправлена администратору на рассмотрение');
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось'));
    } finally {
      setBusy(false);
    }
  };

  const isApproved = app.trainer_status === 'approved';
  const canEdit = !isApproved;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Статус</Text>
        <Text style={[styles.statusValue, {color: STATUS_COLOR[app.trainer_status]}]}>
          {STATUS_LABELS[app.trainer_status]}
        </Text>
      </View>

      <Text style={styles.label}>Навыки и специализация *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Подача, удары справа, тактика игры на задней линии..."
        placeholderTextColor={COLORS.textSecondary}
        value={skills}
        onChangeText={setSkills}
        editable={canEdit}
        multiline
      />

      <Text style={styles.label}>Образование</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="МГУ ФФиС, специалист по теннису..."
        placeholderTextColor={COLORS.textSecondary}
        value={education}
        onChangeText={setEducation}
        editable={canEdit}
        multiline
      />

      <Text style={styles.label}>Достижения</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="МСМК по теннису, чемпион Москвы 2020..."
        placeholderTextColor={COLORS.textSecondary}
        value={achievements}
        onChangeText={setAchievements}
        editable={canEdit}
        multiline
      />

      <Text style={styles.section}>Виды занятий</Text>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Индивидуальные</Text>
        <Switch value={individual} onValueChange={setIndividual} disabled={!canEdit} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Групповые</Text>
        <Switch value={group} onValueChange={setGroup} disabled={!canEdit} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>С детьми</Text>
        <Switch value={kids} onValueChange={setKids} disabled={!canEdit} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>С людьми с инвалидностью</Text>
        <Switch value={disabled} onValueChange={setDisabled} disabled={!canEdit} />
      </View>

      {canEdit && (
        <TouchableOpacity
          style={[styles.submit, busy && styles.disabled]}
          disabled={busy}
          onPress={submit}>
          {busy ? (
            <ActivityIndicator color={COLORS.textLight} />
          ) : (
            <Text style={styles.submitText}>
              {app.trainer_status === 'pending' ? 'Обновить заявку' : 'Подать заявку'}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md, paddingBottom: SPACING.xl},
  center: {flex: 1},
  statusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  statusLabel: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary},
  statusValue: {fontSize: FONT_SIZE.lg, fontWeight: '700', marginTop: 4},
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
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
  textArea: {height: 80, textAlignVertical: 'top'},
  section: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  switchLabel: {fontSize: FONT_SIZE.md, color: COLORS.text},
  submit: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  disabled: {opacity: 0.6},
  submitText: {color: COLORS.textLight, fontSize: FONT_SIZE.md, fontWeight: '700'},
});
