import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {courtTransferApi} from '../../api/feed';
import {bookingsApi} from '../../api/bookings';
import {BookingResponse} from '../../types/booking';
import {groupBookings, BookingGroup} from '../courts/CourtsHomeScreen';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage} from '../../utils/format';

interface RouteParams {
  // pre-filled when coming from CourtGrid "Передать бронь"
  bookingId?: string;
  courtName?: string;
  date?: string;
  slotStart?: string;
  slotEnd?: string;
  locationId?: string;
}

function formatGroupLabel(g: BookingGroup): string {
  const dateStr = g.date.split('-').reverse().slice(0, 2).join('.');
  return `${dateStr} · ${g.slot_start}–${g.slot_end}${g.court_name ? ` · ${g.court_name}` : ''}`;
}

export default function CreateCourtTransferScreen({route, navigation}: any) {
  const params: RouteParams = route?.params ?? {};

  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const groups = useMemo(() => groupBookings(bookings), [bookings]);

  useEffect(() => {
    bookingsApi
      .getMine(true)
      .then(({data}) => setBookings(data))
      .catch(() => {})
      .finally(() => setLoadingBookings(false));
  }, []);

  // Предвыбор группы, содержащей слот из сетки
  useEffect(() => {
    if (selectedIdx !== null || groups.length === 0) return;
    if (params.bookingId) {
      const idx = groups.findIndex(g => g.ids.includes(params.bookingId!));
      setSelectedIdx(idx >= 0 ? idx : 0);
    } else if (groups.length === 1) {
      setSelectedIdx(0);
    }
  }, [groups, params.bookingId, selectedIdx]);

  const selected = selectedIdx !== null ? groups[selectedIdx] ?? null : null;

  const handleCreate = async () => {
    if (!selected) {
      Alert.alert('Выберите бронь', 'Отметьте, какую бронь передать');
      return;
    }
    if (!selected.location_id) {
      Alert.alert('Ошибка', 'У брони не указана локация. Обновите список.');
      return;
    }
    setLoading(true);
    try {
      await courtTransferApi.create({
        location_id: selected.location_id,
        start_time: `${selected.date}T${selected.slot_start}:00`,
        end_time: `${selected.date}T${selected.slot_end}:00`,
        is_paid: isPaid,
        notes: notes || undefined,
      });
      Alert.alert('Готово', 'Предложение о передаче корта создано!');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось создать'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Передать аренду корта</Text>

        <Text style={styles.label}>Какую бронь передать</Text>
        {loadingBookings ? (
          <ActivityIndicator color={COLORS.primary} style={{marginVertical: SPACING.md}} />
        ) : groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              У вас нет активных броней. Сначала забронируйте корт.
            </Text>
          </View>
        ) : (
          <View style={styles.groupList}>
            {groups.map((g, i) => (
              <TouchableOpacity
                key={g.ids[0]}
                style={[styles.groupChip, selectedIdx === i && styles.groupChipActive]}
                onPress={() => setSelectedIdx(i)}>
                <Text
                  style={[styles.groupChipText, selectedIdx === i && styles.groupChipTextActive]}>
                  {formatGroupLabel(g)}
                </Text>
                {!!g.location_name && (
                  <Text
                    style={[
                      styles.groupChipSub,
                      selectedIdx === i && styles.groupChipTextActive,
                    ]}>
                    {g.location_name}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selected && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>🏟 Будет передано</Text>
            <Text style={styles.summaryValue}>
              {selected.date.split('-').reverse().join('.')} · {selected.slot_start} — {selected.slot_end}
            </Text>
            <Text style={styles.summarySub}>
              {[selected.location_name, selected.court_name].filter(Boolean).join(' · ')}
            </Text>
          </View>
        )}

        <View style={styles.switchRow}>
          <Text style={styles.label}>Платно</Text>
          <Switch value={isPaid} onValueChange={setIsPaid} trackColor={{true: COLORS.primaryLight}} />
        </View>

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholderTextColor={COLORS.textSecondary}
          placeholder="Примечание (необязательно)"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.button, (loading || !selected) && styles.disabled]}
          onPress={handleCreate}
          disabled={loading || !selected}>
          {loading ? (
            <ActivityIndicator color={COLORS.textLight} />
          ) : (
            <Text style={styles.buttonText}>Опубликовать</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md, paddingBottom: SPACING.xl},
  title: {fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.primary, marginBottom: SPACING.md},

  label: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs, marginTop: SPACING.sm},

  groupList: {gap: SPACING.sm, marginBottom: SPACING.sm},
  groupChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  groupChipActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  groupChipText: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text},
  groupChipSub: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2},
  groupChipTextActive: {color: COLORS.textLight},

  emptyCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  emptyText: {fontSize: FONT_SIZE.sm, color: COLORS.text},

  summaryCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  summaryTitle: {fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.success},
  summaryValue: {fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginTop: 4},
  summarySub: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2},

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
  textArea: {height: 80, textAlignVertical: 'top'},
  switchRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: SPACING.sm},
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
