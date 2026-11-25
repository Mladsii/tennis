import React, {useEffect, useState} from 'react';
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
import {searchApi} from '../../api/search';
import {bookingsApi} from '../../api/bookings';
import {locationsApi} from '../../api/locations';
import {PreferredLocation} from '../../types/location';
import {BookingResponse} from '../../types/booking';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {GAME_TYPES} from '../../constants/levels';
import {extractErrorMessage} from '../../utils/format';
import {handlePremiumError} from '../../utils/premiumError';

type AvailabilityWindow = 'today' | 'tomorrow' | 'weekend' | 'week' | 'next_week';

const AVAILABILITY_OPTIONS: {value: AvailabilityWindow; label: string}[] = [
  {value: 'today', label: 'Сегодня'},
  {value: 'tomorrow', label: 'Завтра'},
  {value: 'weekend', label: 'Выходные'},
  {value: 'week', label: 'Эта неделя'},
  {value: 'next_week', label: 'След. неделя'},
];

function computeWindow(w: AvailabilityWindow): {start: Date; end: Date} {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (w) {
    case 'today':
      end.setHours(23, 30, 0, 0);
      break;
    case 'tomorrow':
      start.setDate(start.getDate() + 1);
      start.setHours(7, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      end.setHours(23, 30, 0, 0);
      break;
    case 'weekend': {
      const day = now.getDay(); // 0=вс, 6=сб
      const daysUntilSat = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
      start.setDate(start.getDate() + daysUntilSat);
      start.setHours(7, 0, 0, 0);
      end.setDate(end.getDate() + daysUntilSat + 1); // до конца воскресенья
      end.setHours(23, 30, 0, 0);
      break;
    }
    case 'week':
      end.setDate(end.getDate() + 7);
      end.setHours(23, 30, 0, 0);
      break;
    case 'next_week': {
      const day = now.getDay();
      const daysUntilMon = day === 0 ? 1 : 8 - day;
      start.setDate(start.getDate() + daysUntilMon);
      start.setHours(7, 0, 0, 0);
      end.setDate(end.getDate() + daysUntilMon + 6);
      end.setHours(23, 30, 0, 0);
      break;
    }
  }
  return {start, end};
}

function toIsoLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function formatBookingLabel(b: BookingResponse): string {
  const dateStr = b.date ? b.date.split('-').reverse().join('.') : '??';
  const courtStr = b.court_name ? `${b.court_name} · ` : '';
  const locStr = b.location_name ? `${b.location_name} · ` : '';
  return `${locStr}${courtStr}${dateStr} ${b.slot_start}–${b.slot_end}`;
}

export default function CreateSearchScreen({navigation}: any) {
  const [gameType, setGameType] = useState('singles');
  const [hasBooking, setHasBooking] = useState(false);
  const [onlyPreferred, setOnlyPreferred] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [myBookings, setMyBookings] = useState<BookingResponse[]>([]);
  const [stmMode, setStmMode] = useState<'exact' | 'range'>('exact');
  const [stmLevel, setStmLevel] = useState('');
  const [stmMin, setStmMin] = useState('');
  const [stmMax, setStmMax] = useState('');
  const [genderFilter, setGenderFilter] = useState<'' | 'M' | 'F'>('');
  const [availability, setAvailability] = useState<AvailabilityWindow>('week');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<PreferredLocation[]>([]);

  useEffect(() => {
    locationsApi.getPreferred().then(({data}) => setLocations(data)).catch(() => {});
    bookingsApi.getMine(true).then(({data}) => setMyBookings(data)).catch(() => {});
  }, []);

  const selectedBooking = bookingId ? myBookings.find(b => b.id === bookingId) ?? null : null;

  const handleCreate = async () => {
    let startIso: string;
    let endIso: string;
    let openDate = false;

    if (hasBooking) {
      if (!selectedBooking) {
        Alert.alert('Выберите бронь', 'Отметьте одну из своих броней');
        return;
      }
      startIso = `${selectedBooking.date}T${selectedBooking.slot_start}:00`;
      endIso = `${selectedBooking.date}T${selectedBooking.slot_end}:00`;
    } else {
      const {start, end} = computeWindow(availability);
      startIso = toIsoLocal(start);
      endIso = toIsoLocal(end);
      openDate = true;
    }

    setLoading(true);
    try {
      await searchApi.create({
        game_type: gameType as any,
        court_booked: hasBooking,
        location_id: locationId || undefined,
        booking_id: hasBooking ? bookingId ?? undefined : undefined,
        stm_level: stmMode === 'exact' ? (stmLevel || undefined) : undefined,
        stm_min: stmMode === 'range' ? (stmMin || undefined) : undefined,
        stm_max: stmMode === 'range' ? (stmMax || undefined) : undefined,
        gender_filter: genderFilter || undefined,
        start_time: startIso,
        end_time: endIso,
        notes: notes || undefined,
        only_preferred: onlyPreferred,
        open_date: openDate,
      });
      Alert.alert('Готово', 'Запрос на поиск партнёра создан!');
      navigation.goBack();
    } catch (e: any) {
      if (!handlePremiumError(e, navigation)) {
        Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось создать запрос'));
      }
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
      <View style={styles.titleRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Новый поиск</Text>
      </View>

      <Text style={styles.label}>Тип игры</Text>
      <View style={styles.row}>
        {GAME_TYPES.map(gt => (
          <TouchableOpacity
            key={gt.value}
            style={[styles.chip, gameType === gt.value && styles.chipActive]}
            onPress={() => setGameType(gt.value)}>
            <Text style={[styles.chipText, gameType === gt.value && styles.chipTextActive]}>
              {gt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.switchRow}>
        <View style={{flex: 1}}>
          <Text style={styles.label}>У меня есть бронь корта</Text>
          <Text style={styles.hint}>
            Партнёр будет знать заранее корт и время
          </Text>
        </View>
        <Switch
          value={hasBooking}
          onValueChange={v => {
            setHasBooking(v);
            if (!v) setBookingId(null);
          }}
          trackColor={{true: COLORS.primaryLight}}
        />
      </View>

      {hasBooking ? (
        <>
          <Text style={styles.label}>Выберите бронь</Text>
          {myBookings.length === 0 ? (
            <View style={styles.noBookingCard}>
              <Text style={styles.noBookingText}>
                ⚠️ Нет активных броней. Забронируйте корт во вкладке «Корты» или выключите этот флаг.
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.locRow}>
              {myBookings.map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.locChip, bookingId === b.id && styles.chipActive]}
                  onPress={() => setBookingId(b.id)}>
                  <Text
                    style={[styles.chipText, bookingId === b.id && styles.chipTextActive]}
                    numberOfLines={1}>
                    {formatBookingLabel(b)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {selectedBooking && (
            <View style={styles.bookingLockedCard}>
              <Text style={styles.bookingLockedTitle}>🔒 Дата и время из брони</Text>
              <Text style={styles.bookingLockedDetail}>
                {selectedBooking.location_name ? `${selectedBooking.location_name} · ` : ''}
                {selectedBooking.court_name ?? 'Корт'}
              </Text>
              <Text style={styles.bookingLockedTime}>
                {selectedBooking.date.split('-').reverse().join('.')}  ·  {selectedBooking.slot_start}–{selectedBooking.slot_end}
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={styles.label}>Когда готов играть</Text>
          <View style={styles.row}>
            {AVAILABILITY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, availability === opt.value && styles.chipActive]}
                onPress={() => setAvailability(opt.value)}>
                <Text
                  style={[
                    styles.chipText,
                    availability === opt.value && styles.chipTextActive,
                  ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>
            Точное время и корт согласуете с партнёром в чате
          </Text>
        </>
      )}

      {locations.length > 0 && (
        <>
          <Text style={styles.label}>Локация</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.locRow}>
            <TouchableOpacity
              style={[styles.locChip, !locationId && styles.chipActive]}
              onPress={() => setLocationId(null)}>
              <Text style={[styles.chipText, !locationId && styles.chipTextActive]}>Любая</Text>
            </TouchableOpacity>
            {locations.filter(l => l.use_in_search).map(l => (
              <TouchableOpacity
                key={l.id}
                style={[styles.locChip, locationId === l.location_id && styles.chipActive]}
                onPress={() => setLocationId(l.location_id)}>
                <Text style={[styles.chipText, locationId === l.location_id && styles.chipTextActive]}>
                  {l.location.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={styles.label}>СТМ партнёра</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.chip, stmMode === 'exact' && styles.chipActive]}
          onPress={() => setStmMode('exact')}>
          <Text style={[styles.chipText, stmMode === 'exact' && styles.chipTextActive]}>Точное значение</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, stmMode === 'range' && styles.chipActive]}
          onPress={() => setStmMode('range')}>
          <Text style={[styles.chipText, stmMode === 'range' && styles.chipTextActive]}>Диапазон</Text>
        </TouchableOpacity>
      </View>
      {stmMode === 'exact' ? (
        <TextInput
          style={styles.input}
          placeholderTextColor={COLORS.textSecondary}
          placeholder="СТМ партнёра (необязательно)"
          value={stmLevel}
          onChangeText={setStmLevel}
          keyboardType="numeric"
        />
      ) : (
        <View style={styles.timeRow}>
          <TextInput
            style={[styles.input, styles.timeInput]}
            placeholderTextColor={COLORS.textSecondary}
            placeholder="От"
            value={stmMin}
            onChangeText={setStmMin}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.timeInput]}
            placeholderTextColor={COLORS.textSecondary}
            placeholder="До"
            value={stmMax}
            onChangeText={setStmMax}
            keyboardType="numeric"
          />
        </View>
      )}

      <Text style={styles.label}>Пол партнёра</Text>
      <View style={styles.row}>
        {[
          {value: '' as const, label: 'Любой'},
          {value: 'M' as const, label: 'Мужской'},
          {value: 'F' as const, label: 'Женский'},
        ].map(g => (
          <TouchableOpacity
            key={g.value}
            style={[styles.chip, genderFilter === g.value && styles.chipActive]}
            onPress={() => setGenderFilter(g.value)}>
            <Text style={[styles.chipText, genderFilter === g.value && styles.chipTextActive]}>
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.switchRow}>
        <View style={{flex: 1}}>
          <Text style={styles.label}>Только друзья</Text>
          <Text style={styles.hint}>
            Запрос увидят только ваши друзья
          </Text>
        </View>
        <Switch
          value={onlyPreferred}
          onValueChange={setOnlyPreferred}
          trackColor={{true: COLORS.primaryLight}}
        />
      </View>

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Примечание"
        placeholderTextColor={COLORS.textSecondary}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.disabled]}
        onPress={handleCreate}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color={COLORS.textLight} />
        ) : (
          <Text style={styles.buttonText}>Найти партнёра</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md},
  titleRow: {flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm},
  backBtn: {paddingVertical: 4, paddingRight: SPACING.sm},
  backBtnText: {fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600'},
  title: {fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.primary},
  label: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs, marginTop: SPACING.sm},
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm},
  locRow: {marginBottom: SPACING.sm},
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  locChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    marginRight: SPACING.sm,
  },
  chipActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  chipText: {fontSize: FONT_SIZE.sm, color: COLORS.text},
  chipTextActive: {color: COLORS.textLight},
  switchRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: SPACING.sm, gap: SPACING.md},
  hint: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2},
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
  timeRow: {flexDirection: 'row', gap: SPACING.sm},
  timeInput: {flex: 1},
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  disabled: {opacity: 0.6},
  buttonText: {color: COLORS.textLight, fontSize: FONT_SIZE.lg, fontWeight: '600'},
  noBookingCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  noBookingText: {fontSize: FONT_SIZE.sm, color: COLORS.text},
  bookingLockedCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  bookingLockedTitle: {fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.success},
  bookingLockedDetail: {fontSize: FONT_SIZE.sm, color: COLORS.text, marginTop: 4},
  bookingLockedTime: {fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.primary, marginTop: 4},
});
