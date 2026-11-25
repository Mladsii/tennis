import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {trainingsApi} from '../../api/trainings';
import {preferredPlayersApi} from '../../api/feed';
import {PreferredPlayer} from '../../types/feed';
import {TrainingScheduleType} from '../../types/training';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage} from '../../utils/format';

export default function CreateTrainingScreen({navigation}: any) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [scheduleType, setScheduleType] = useState<TrainingScheduleType>('one_time');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('20:30');
  const [weeksCount, setWeeksCount] = useState('4');
  const [maxParticipants, setMaxParticipants] = useState('');

  const [players, setPlayers] = useState<PreferredPlayer[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    preferredPlayersApi
      .list()
      .then(({data}) => setPlayers(data.filter(p => p.is_active)))
      .catch(() => {});
  }, []);

  const toggleInvite = (id: string) => {
    setInvitedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!title.trim()) return Alert.alert('Ошибка', 'Введите название');
    setLoading(true);
    try {
      const startIso = new Date(`${date}T${startTime}:00`).toISOString();
      const endIso = new Date(`${date}T${endTime}:00`).toISOString();
      await trainingsApi.create({
        title: title.trim(),
        description: description || null,
        location: location || null,
        schedule_type: scheduleType,
        start_time: startIso,
        end_time: endIso,
        weeks_count: scheduleType === 'weekly' ? parseInt(weeksCount, 10) || 1 : null,
        max_participants: maxParticipants ? parseInt(maxParticipants, 10) : null,
        invite_user_ids: Array.from(invitedIds),
      });
      Alert.alert('Готово', 'Тренировка создана, приглашения отправлены');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось создать'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Название</Text>
      <TextInput
        style={styles.input}
        placeholder="Тренировка с тренером"
        placeholderTextColor={COLORS.textSecondary}
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Описание</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Подача, удары справа..."
        placeholderTextColor={COLORS.textSecondary}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.label}>Место</Text>
      <TextInput
        style={styles.input}
        placeholder="КСК Спартак, корт 3"
        placeholderTextColor={COLORS.textSecondary}
        value={location}
        onChangeText={setLocation}
      />

      <Text style={styles.label}>Тип</Text>
      <View style={styles.chipsRow}>
        <TouchableOpacity
          style={[styles.chip, scheduleType === 'one_time' && styles.chipActive]}
          onPress={() => setScheduleType('one_time')}>
          <Text style={[styles.chipText, scheduleType === 'one_time' && styles.chipTextActive]}>
            Разовая
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, scheduleType === 'weekly' && styles.chipActive]}
          onPress={() => setScheduleType('weekly')}>
          <Text style={[styles.chipText, scheduleType === 'weekly' && styles.chipTextActive]}>
            Еженедельная
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dateRow}>
        <View style={styles.dateInput}>
          <Text style={styles.label}>Дата</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-04-30"
            placeholderTextColor={COLORS.textSecondary}
            value={date}
            onChangeText={setDate}
          />
        </View>
      </View>
      <View style={styles.dateRow}>
        <View style={styles.dateInput}>
          <Text style={styles.label}>Начало</Text>
          <TextInput
            style={styles.input}
            placeholder="19:00"
            placeholderTextColor={COLORS.textSecondary}
            value={startTime}
            onChangeText={setStartTime}
          />
        </View>
        <View style={styles.dateInput}>
          <Text style={styles.label}>Конец</Text>
          <TextInput
            style={styles.input}
            placeholder="20:30"
            placeholderTextColor={COLORS.textSecondary}
            value={endTime}
            onChangeText={setEndTime}
          />
        </View>
      </View>

      {scheduleType === 'weekly' && (
        <>
          <Text style={styles.label}>Количество недель</Text>
          <TextInput
            style={styles.input}
            placeholder="4"
            keyboardType="numeric"
            placeholderTextColor={COLORS.textSecondary}
            value={weeksCount}
            onChangeText={setWeeksCount}
          />
        </>
      )}

      <Text style={styles.label}>Макс. участников</Text>
      <TextInput
        style={styles.input}
        placeholder="4"
        keyboardType="numeric"
        placeholderTextColor={COLORS.textSecondary}
        value={maxParticipants}
        onChangeText={setMaxParticipants}
      />

      <Text style={styles.section}>Пригласить ({invitedIds.size})</Text>
      {players.length === 0 ? (
        <Text style={styles.hint}>
          Добавьте друзей, чтобы пригласить
        </Text>
      ) : (
        <View style={styles.chipsRow}>
          {players.map(p => {
            const sel = invitedIds.has(p.player.id);
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, sel && styles.chipActive]}
                onPress={() => toggleInvite(p.player.id)}>
                <Text style={[styles.chipText, sel && styles.chipTextActive]}>
                  {sel ? '✓ ' : ''}{p.player.last_name} {p.player.first_name[0]}.
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <TouchableOpacity
        style={[styles.submit, loading && styles.disabled]}
        disabled={loading}
        onPress={submit}>
        {loading ? (
          <ActivityIndicator color={COLORS.textLight} />
        ) : (
          <Text style={styles.submitText}>Создать тренировку</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md, paddingBottom: SPACING.xl},
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  hint: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: SPACING.xs},
  section: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
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
  dateRow: {flexDirection: 'row', gap: SPACING.md},
  dateInput: {flex: 1},
  chipsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm},
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
