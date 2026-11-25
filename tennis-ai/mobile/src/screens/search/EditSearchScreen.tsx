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
import {SearchRequest} from '../../types/search';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {GAME_TYPES} from '../../constants/levels';
import {extractErrorMessage} from '../../utils/format';
import {NativeDateField, NativeTimeField} from '../../components/common/NativeDateTimeField';

function formatBookingLabel(b: BookingResponse): string {
  const dateStr = b.date ? b.date.split('-').reverse().join('.') : '??';
  const courtStr = b.court_name ? `${b.court_name} · ` : '';
  const locStr = b.location_name ? `${b.location_name} · ` : '';
  return `${locStr}${courtStr}${dateStr} ${b.slot_start}–${b.slot_end}`;
}

export default function EditSearchScreen({route, navigation}: any) {
  const sr: SearchRequest = route.params.searchRequest;

  const [gameType, setGameType] = useState(sr.game_type);
  const [hasBooking, setHasBooking] = useState(sr.court_booked);
  const [bookingId, setBookingId] = useState<string | null>(sr.booking_id ?? null);
  const [myBookings, setMyBookings] = useState<BookingResponse[]>([]);
  const [onlyPreferred, setOnlyPreferred] = useState(sr.only_preferred ?? false);
  const [openDate, setOpenDate] = useState(sr.open_date ?? false);
  const [locationId, setLocationId] = useState<string | null>(sr.location_id ?? null);
  const [locations, setLocations] = useState<PreferredLocation[]>([]);

  const [stmMode, setStmMode] = useState<'exact' | 'range'>(sr.stm_min || sr.stm_max ? 'range' : 'exact');
  const [stmLevel, setStmLevel] = useState(sr.stm_level ?? '');
  const [stmMin, setStmMin] = useState(sr.stm_min ?? '');
  const [stmMax, setStmMax] = useState(sr.stm_max ?? '');
  const [genderFilter, setGenderFilter] = useState<'' | 'M' | 'F'>((sr.gender_filter as any) ?? '');

  const [gameDate, setGameDate] = useState(() => new Date(sr.start_time));
  const [startTime, setStartTime] = useState(() => new Date(sr.start_time));
  const [endTime, setEndTime] = useState(() => new Date(sr.end_time));
  const [notes, setNotes] = useState(sr.notes ?? '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    locationsApi.getPreferred().then(({data}) => setLocations(data)).catch(() => {});
    bookingsApi.getMine(true).then(({data}) => setMyBookings(data)).catch(() => {});
  }, []);

  const selectedBooking = bookingId ? myBookings.find(b => b.id === bookingId) ?? null : null;

  const handleSave = async () => {
    let startIso: string;
    let endIso: string;
    let effectiveOpenDate = openDate;

    if (hasBooking) {
      if (!selectedBooking) {
        Alert.alert('Выберите бронь', 'Отметьте одну из своих броней');
        return;
      }
      startIso = `${selectedBooking.date}T${selectedBooking.slot_start}:00`;
      endIso = `${selectedBooking.date}T${selectedBooking.slot_end}:00`;
      effectiveOpenDate = false;
    } else if (openDate) {
      const today = new Date().toISOString().slice(0, 10);
      const future = new Date();
      future.setDate(future.getDate() + 30);
      startIso = `${today}T00:00:00`;
      endIso = `${future.toISOString().slice(0, 10)}T23:59:59`;
    } else {
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${gameDate.getFullYear()}-${pad(gameDate.getMonth() + 1)}-${pad(gameDate.getDate())}`;
      if (endTime <= startTime) {
        Alert.alert('Ошибка', 'Время окончания должно быть позже начала');
        return;
      }
      startIso = `${dateStr}T${pad(startTime.getHours())}:${pad(startTime.getMinutes())}:00`;
      endIso = `${dateStr}T${pad(endTime.getHours())}:${pad(endTime.getMinutes())}:00`;
    }

    setLoading(true);
    try {
      await searchApi.update(sr.id, {
        game_type: gameType as any,
        court_booked: hasBooking,
        booking_id: hasBooking ? bookingId ?? undefined : undefined,
        location_id: locationId || undefined,
        stm_level: stmMode === 'exact' ? (stmLevel || undefined) : undefined,
        stm_min: stmMode === 'range' ? (stmMin || undefined) : undefined,
        stm_max: stmMode === 'range' ? (stmMax || undefined) : undefined,
        gender_filter: genderFilter || undefined,
        start_time: startIso,
        end_time: endIso,
        notes: notes || undefined,
        only_preferred: onlyPreferred,
        open_date: effectiveOpenDate,
      });
      Alert.alert('Сохранено', 'Поиск обновлён');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось обновить'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Редактировать поиск</Text>

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
            <Text style={styles.hint}>Партнёр будет знать заранее корт и время</Text>
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
                  {selectedBooking.date.split('-').reverse().join('.')} · {selectedBooking.slot_start}–{selectedBooking.slot_end}
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.switchRow}>
              <View style={{flex: 1}}>
                <Text style={styles.label}>Открытая дата</Text>
                <Text style={styles.hint}>Дата и время не важны</Text>
              </View>
              <Switch value={openDate} onValueChange={setOpenDate} trackColor={{true: COLORS.primaryLight}} />
            </View>

            {!openDate && (
              <>
                <NativeDateField label="Дата игры" value={gameDate} onChange={setGameDate} minimumDate={new Date()} />
                <View style={styles.timeRow}>
                  <View style={styles.timeInput}>
                    <NativeTimeField label="Начало" value={startTime} onChange={setStartTime} />
                  </View>
                  <View style={styles.timeInput}>
                    <NativeTimeField label="Окончание" value={endTime} onChange={setEndTime} />
                  </View>
                </View>
              </>
            )}
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
            <Text style={styles.hint}>Уведомление получат только игроки из вашего списка</Text>
          </View>
          <Switch value={onlyPreferred} onValueChange={setOnlyPreferred} trackColor={{true: COLORS.primaryLight}} />
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
          onPress={handleSave}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={COLORS.textLight} />
          ) : (
            <Text style={styles.buttonText}>Сохранить изменения</Text>
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
  hint: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2},
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm},
  locRow: {marginBottom: SPACING.sm},
  chip: {paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface},
  locChip: {paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginRight: SPACING.sm},
  chipActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  chipText: {fontSize: FONT_SIZE.sm, color: COLORS.text},
  chipTextActive: {color: COLORS.textLight},
  switchRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: SPACING.sm, gap: SPACING.md},
  input: {backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: SPACING.md, fontSize: FONT_SIZE.md, marginBottom: SPACING.sm, color: COLORS.text},
  textArea: {height: 80, textAlignVertical: 'top'},
  timeRow: {flexDirection: 'row', gap: SPACING.sm},
  timeInput: {flex: 1},
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
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  bookingLockedTitle: {fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.success},
  bookingLockedDetail: {fontSize: FONT_SIZE.sm, color: COLORS.text, marginTop: 4},
  bookingLockedTime: {fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.primary, marginTop: 4},
  button: {backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: 12, alignItems: 'center', marginTop: SPACING.md},
  disabled: {opacity: 0.6},
  buttonText: {color: COLORS.textLight, fontSize: FONT_SIZE.lg, fontWeight: '600'},
});
