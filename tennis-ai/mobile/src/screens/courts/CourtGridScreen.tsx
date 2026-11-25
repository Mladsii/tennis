import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Switch,
  Vibration,
} from 'react-native';
import {bookingsApi} from '../../api/bookings';
import {queueApi} from '../../api/queue';
import {CourtGrid, LocationGrid, SlotInfo} from '../../types/booking';
import {COLORS, FONT_SIZE, SPACING, SHADOWS} from '../../constants/theme';
import {extractErrorMessage} from '../../utils/format';
import BottomSheet, {SheetAction} from '../../components/common/BottomSheet';

const SLOT_W = 72;
const SLOT_H = 52;
const ROW_LABEL_W = 120;
const CALENDAR_DAYS = 14;

const C_FREE = '#FFFFFF';
const C_FREE_BORDER = '#CFD8DC';
const C_MINE = '#4CAF50';
const C_MINE_RECURRING = '#9C27B0';
const C_BOOKED = '#E53935';
const C_SELECTED = '#FF9800';

const RU_WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const RU_MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return localDateStr(new Date());
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

function generateCalendarDays(): string[] {
  const today = todayStr();
  return Array.from({length: CALENDAR_DAYS}, (_, i) => addDays(today, i));
}

function parseDateStr(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

function formatDateHeader(dateStr: string): string {
  const dt = parseDateStr(dateStr);
  const weekday = RU_WEEKDAYS[dt.getDay()];
  const day = dt.getDate();
  const month = RU_MONTHS_SHORT[dt.getMonth()];
  return `${weekday}, ${day} ${month}`;
}

interface SelectionRange {
  courtId: string;
  startIdx: number;
  endIdx: number;
}

interface QueueModalState {
  courtId: string;
  courtName: string;
  slotStart: string; // HH:MM — тапнутый занятый слот
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function QueueJoinModal({state, date, onClose, onJoined}: {
  state: QueueModalState;
  date: string;
  onClose: () => void;
  onJoined: () => void;
}) {
  const [durationH, setDurationH] = useState(1); // желаемая длительность
  const [anyCourt, setAnyCourt] = useState(true);
  const [acceptPartial, setAcceptPartial] = useState(false);
  const [busy, setBusy] = useState(false);

  const slotEnd = addMinutes(state.slotStart, Math.round(durationH * 60));

  const join = async () => {
    setBusy(true);
    try {
      await queueApi.join(state.courtId, date, state.slotStart, {
        slotEnd,
        minDuration: Math.round(durationH * 60),
        acceptPartial,
        anyCourt,
      });
      Vibration.vibrate(60);
      onJoined();
      onClose();
      Alert.alert(
        '⏳ Вы в очереди',
        `Ждём окно ${state.slotStart}–${slotEnd}${anyCourt ? ' на любом корте' : ''}. ` +
        'Придёт уведомление, как только время освободится.',
      );
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось встать в очередь'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.qmBackdrop}>
        <View style={styles.qmCard}>
          <Text style={styles.qmTitle}>⏳ Встать в очередь</Text>
          <Text style={styles.qmSubtitle}>
            {state.courtName} · c {state.slotStart}
          </Text>

          <Text style={styles.qmLabel}>Сколько хочу играть</Text>
          <View style={styles.qmDurationRow}>
            {[1, 1.5, 2].map(h => (
              <TouchableOpacity
                key={h}
                style={[styles.qmDurBtn, durationH === h && styles.qmDurBtnActive]}
                onPress={() => setDurationH(h)}>
                <Text style={[styles.qmDurText, durationH === h && styles.qmDurTextActive]}>
                  {h === 1.5 ? '1.5 ч' : `${h} ч`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.qmInterval}>
            Интервал ожидания: {state.slotStart} – {slotEnd}
          </Text>

          <View style={styles.qmSwitchRow}>
            <View style={{flex: 1}}>
              <Text style={styles.qmSwitchLabel}>Любой корт локации</Text>
              <Text style={styles.qmHint}>Без разницы на каком корте играть</Text>
            </View>
            <Switch value={anyCourt} onValueChange={setAnyCourt} trackColor={{true: COLORS.primaryLight}} />
          </View>

          <View style={styles.qmSwitchRow}>
            <View style={{flex: 1}}>
              <Text style={styles.qmSwitchLabel}>Соглашусь на меньшее</Text>
              <Text style={styles.qmHint}>Уведомить, даже если освободится меньше времени</Text>
            </View>
            <Switch value={acceptPartial} onValueChange={setAcceptPartial} trackColor={{true: COLORS.primaryLight}} />
          </View>

          <View style={styles.qmActions}>
            <TouchableOpacity style={styles.qmCancelBtn} onPress={onClose} disabled={busy}>
              <Text style={styles.qmCancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.qmJoinBtn, busy && {opacity: 0.6}]} onPress={join} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.qmJoinText}>В очередь</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function CourtGridScreen({route, navigation}: any) {
  const {locationId, locationName} = route.params as {
    locationId: string;
    locationName: string;
  };

  useEffect(() => {
    navigation.setOptions({
      title: locationName,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('MyQueue' as any)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFF3E0',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 14,
          }}>
          <Text style={{fontSize: 13, fontWeight: '600', color: '#E65100'}}>⏳ Очередь</Text>
        </TouchableOpacity>
      ),
    });
  }, [locationName, navigation]);

  const calendarDays = useMemo(() => generateCalendarDays(), []);
  const calendarScrollRef = useRef<ScrollView>(null);

  const [date, setDate] = useState(() => todayStr());
  const [grid, setGrid] = useState<LocationGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState(false); // лёгкий оверлей при смене даты
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [queueModal, setQueueModal] = useState<QueueModalState | null>(null);
  const [sheet, setSheet] = useState<{
    title: string;
    subtitle?: string;
    actions: SheetAction[];
  } | null>(null);
  const [sportFilter, setSportFilter] = useState<'all' | 'tennis' | 'padel'>('all');
  const [courtType, setCourtType] = useState<'all' | 'singles' | 'doubles'>('all');

  const load = useCallback(
    async (d: string, ct: 'all' | 'singles' | 'doubles' = 'all') => {
      try {
        const apiCourtType = ct !== 'all' ? ct : undefined;
        const {data} = await bookingsApi.getGrid(locationId, d, apiCourtType);
        setGrid(data);
      } catch {} finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [locationId],
  );

  useEffect(() => {
    // Первая загрузка — полный спиннер; последующие — лёгкий оверлей
    if (!grid) {
      setLoading(true);
    } else {
      setUpdating(true);
    }
    load(date, courtType).finally(() => setUpdating(false));
    setSelection(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, courtType]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(date, courtType);
  };

  const changeDay = (delta: number) => {
    const newDate = addDays(date, delta);
    const today = todayStr();
    if (newDate < today) return;
    setDate(newDate); // loading определяется в useEffect выше
  };

  const hScrollRef = useRef<ScrollView>(null);

  // Текущий 30-минутный слот (для подсветки и автоскролла)
  const nowSlotHM = (() => {
    const n = new Date();
    const mins = n.getMinutes() < 30 ? '00' : '30';
    return `${String(n.getHours()).padStart(2, '0')}:${mins}`;
  })();

  const isCurrentSlot = (t: string) => date === todayStr() && t === nowSlotHM;

  const scrollToNow = () => {
    if (date !== todayStr()) return;
    const idx = timeLabels.indexOf(nowSlotHM);
    if (idx > 1) {
      hScrollRef.current?.scrollTo({x: (idx - 1) * SLOT_W, animated: true});
    }
  };

  const isPastSlot = (slot: SlotInfo): boolean => {
    if (date > todayStr()) return false;
    if (date < todayStr()) return true;
    const now = new Date();
    const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return slot.slot_end <= nowHM;
  };

  const handleSlotTap = (court: CourtGrid, slot: SlotInfo, slotIdx: number) => {
    if (busy) return;

    if (isPastSlot(slot) && slot.status === 'free') {
      Alert.alert('Время прошло', 'Нельзя забронировать прошедшее время');
      return;
    }

    if (slot.status === 'mine') {
      setSheet({
        title: 'Ваша бронь',
        subtitle: `${court.court_name} · ${slot.slot_start}–${slot.slot_end}`,
        actions: [
          {
            label: 'Передать бронь',
            icon: '🔄',
            primary: true,
            onPress: () => {
              navigation.navigate('CreateCourtTransfer' as any, {
                bookingId: slot.booking_id,
                courtName: court.court_name,
                date,
                slotStart: slot.slot_start,
                slotEnd: slot.slot_end,
              });
            },
          },
          {
            label: 'Отменить бронь',
            icon: '✕',
            destructive: true,
            onPress: async () => {
              if (!slot.booking_id) return;
              setBusy(true);
              try {
                await bookingsApi.cancel(slot.booking_id);
                await load(date, courtType);
              } catch (e: any) {
                Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось отменить'));
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      });
      return;
    }

    if (slot.status === 'booked') {
      const actions: SheetAction[] = [
        {
          label: 'Встать в очередь',
          icon: '⏳',
          primary: true,
          onPress: () =>
            setQueueModal({
              courtId: court.court_id,
              courtName: court.court_name,
              slotStart: slot.slot_start,
            }),
        },
      ];
      if (slot.player_id) {
        actions.push({
          label: 'Профиль игрока',
          icon: '👤',
          onPress: () =>
            navigation.navigate('PlayerProfile' as any, {userId: slot.player_id}),
        });
      }
      setSheet({
        title: 'Слот занят',
        subtitle: `${court.court_name} · ${slot.slot_start}–${slot.slot_end}${slot.player_name ? `\n👤 ${slot.player_name}` : ''}`,
        actions,
      });
      return;
    }

    // Free slot → range select
    if (!selection || selection.courtId !== court.court_id) {
      // Первый тап: автоматически выделяем 1 час (2 слота по 30 мин)
      const desiredEnd = slotIdx + 1;
      let endIdx = slotIdx;
      if (desiredEnd < court.slots.length && court.slots[desiredEnd].status === 'free') {
        endIdx = desiredEnd;
      }
      setSelection({courtId: court.court_id, startIdx: slotIdx, endIdx});
      return;
    }

    const lo = Math.min(selection.startIdx, slotIdx);
    const hi = Math.max(selection.startIdx, slotIdx);
    for (let i = lo; i <= hi; i++) {
      if (court.slots[i].status !== 'free') {
        Alert.alert('Не все слоты свободны', 'В диапазоне есть занятые слоты');
        return;
      }
    }
    setSelection({courtId: court.court_id, startIdx: lo, endIdx: hi});
  };

  const applyDuration = (hours: number) => {
    if (!selection || !grid) return;
    const court = grid.courts.find(c => c.court_id === selection.courtId);
    if (!court) return;
    const slotsNeeded = Math.round(hours * 2); // 30 мин на слот
    const startIdx = selection.startIdx;
    const endIdx = startIdx + slotsNeeded - 1;
    if (endIdx >= court.slots.length) {
      Alert.alert('Не хватает слотов', `После выбранного времени нет ${hours} ч подряд`);
      return;
    }
    for (let i = startIdx; i <= endIdx; i++) {
      if (court.slots[i].status !== 'free') {
        Alert.alert('Занято', `В диапазоне ${hours} ч есть занятые слоты`);
        return;
      }
    }
    setSelection({courtId: court.court_id, startIdx, endIdx});
  };

  const confirmBooking = async () => {
    if (!selection || !grid) return;
    const court = grid.courts.find(c => c.court_id === selection.courtId);
    if (!court) return;
    const slots = court.slots.slice(selection.startIdx, selection.endIdx + 1);
    if (slots.length < 2) {
      Alert.alert('Минимум 1 час', 'Игра должна длиться не менее 1 часа. Расширьте выбор.');
      return;
    }
    const startTime = slots[0].slot_start;
    const endTime = slots[slots.length - 1].slot_end;
    const priceTotal =
      court.price_per_slot != null
        ? (court.price_per_slot * slots.length).toFixed(0) + ' ₽'
        : null;

    Alert.alert(
      'Забронировать',
      `${court.court_name}\n${startTime} — ${endTime} (${slots.length} × 30 мин)${priceTotal ? '\nИтого: ' + priceTotal : ''}`,
      [
        {text: 'Отмена', style: 'cancel'},
        {
          text: 'Забронировать',
          onPress: async () => {
            setBusy(true);
            const failed: string[] = [];
            try {
              for (const s of slots) {
                try {
                  await bookingsApi.book(court.court_id, date, s.slot_start);
                } catch {
                  failed.push(s.slot_start);
                }
              }
              setSelection(null);
              await load(date, courtType);
              if (failed.length) {
                Alert.alert('Частично', `Не удалось забронировать: ${failed.join(', ')}`);
              } else {
                Vibration.vibrate(60);
              }
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const isInSelection = (courtId: string, idx: number) =>
    selection?.courtId === courtId &&
    idx >= selection.startIdx &&
    idx <= selection.endIdx;

  const slotColor = (slot: SlotInfo, selected: boolean): string => {
    if (selected) return C_SELECTED;
    if (slot.status === 'free') {
      return isPastSlot(slot) ? '#ECEFF1' : C_FREE;
    }
    if (slot.status === 'mine') {
      return (slot as any).is_recurring ? C_MINE_RECURRING : C_MINE;
    }
    return C_BOOKED;
  };

  const timeLabels = grid?.courts[0]?.slots.map(s => s.slot_start) ?? [];

  const filteredCourts = useMemo(() => {
    if (!grid) return [];
    return grid.courts.filter(c => {
      if (sportFilter !== 'all' && c.sport && c.sport !== sportFilter) return false;
      return true;
    });
  }, [grid, sportFilter]);

  const selectedCourtInfo = useMemo(() => {
    if (!selection || !grid) return null;
    const court = grid.courts.find(c => c.court_id === selection.courtId);
    if (!court) return null;
    const count = selection.endIdx - selection.startIdx + 1;
    const slots = court.slots.slice(selection.startIdx, selection.endIdx + 1);
    const startTime = slots[0].slot_start;
    const endTime = slots[slots.length - 1].slot_end;
    const price = court.price_per_slot != null ? court.price_per_slot * count : null;
    return {court, count, startTime, endTime, price};
  }, [selection, grid]);

  const isPrevDisabled = date <= todayStr();

  return (
    <View style={styles.container}>
      {queueModal && (
        <QueueJoinModal
          state={queueModal}
          date={date}
          onClose={() => setQueueModal(null)}
          onJoined={() => load(date, courtType)}
        />
      )}
      <BottomSheet
        visible={!!sheet}
        title={sheet?.title ?? ''}
        subtitle={sheet?.subtitle}
        actions={sheet?.actions ?? []}
        onClose={() => setSheet(null)}
      />
      {/* Date header with arrows */}
      <View style={styles.dateHeader}>
        <TouchableOpacity
          style={[styles.arrowBtn, isPrevDisabled && styles.arrowBtnDisabled]}
          onPress={() => changeDay(-1)}
          disabled={isPrevDisabled}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
          activeOpacity={0.6}>
          <Text style={[styles.arrowText, isPrevDisabled && styles.arrowTextDisabled]}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateLabelWrap}
          onPress={() => {
            setDate(todayStr());
          }}
          activeOpacity={0.7}>
          <Text style={styles.dateLabelMain}>{formatDateHeader(date)}</Text>
          {date !== todayStr() && (
            <Text style={styles.dateLabelSub}>Нажмите для возврата к сегодня</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.arrowBtn}
          onPress={() => changeDay(1)}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
          activeOpacity={0.6}>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 14-day calendar strip */}
      <View style={styles.calendarWrapper}>
        <ScrollView
          ref={calendarScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.calendarContent}>
          {calendarDays.map(d => {
            const dt = parseDateStr(d);
            const isToday = d === todayStr();
            const isSelected = d === date;
            const weekday = RU_WEEKDAYS[dt.getDay()];
            const dayNum = dt.getDate();
            return (
              <TouchableOpacity
                key={d}
                style={[
                  styles.calDay,
                  isSelected && styles.calDaySelected,
                  isToday && !isSelected && styles.calDayToday,
                ]}
                onPress={() => {
                  setDate(d);
                }}>
                <Text
                  style={[
                    styles.calWeekday,
                    isSelected && styles.calTextSelected,
                    isToday && !isSelected && styles.calTodayText,
                  ]}>
                  {weekday}
                </Text>
                <Text
                  style={[
                    styles.calDayNum,
                    isSelected && styles.calTextSelected,
                    isToday && !isSelected && styles.calTodayText,
                  ]}>
                  {dayNum}
                </Text>
                {isToday && (
                  <View style={[styles.calDot, isSelected && styles.calDotSelected]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Filters row: all in one horizontal ScrollView */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}>
          {(['all', 'tennis', 'padel'] as const).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.filterBtn, sportFilter === s && styles.filterBtnActive]}
              onPress={() => setSportFilter(s)}>
              <Text style={[styles.filterText, sportFilter === s && styles.filterTextActive]}>
                {s === 'all' ? 'Все корты' : s === 'tennis' ? '🎾 Теннис' : '🥎 Падел'}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.filterDivider} />

          {(['all', 'singles', 'doubles'] as const).map(ct => (
            <TouchableOpacity
              key={ct}
              style={[styles.filterBtn, courtType === ct && styles.filterBtnActive]}
              onPress={() => setCourtType(ct)}>
              <Text style={[styles.filterText, courtType === ct && styles.filterTextActive]}>
                {ct === 'all' ? 'Все' : ct === 'singles' ? '1×1' : '2×2'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Selection action bar */}
      {selection && selectedCourtInfo && (
        <View style={styles.actionBarWrapper}>
          <View style={styles.durationRow}>
            <Text style={styles.durationLabel}>Длительность:</Text>
            {[1, 1.5, 2].map(h => {
              const active = selectedCourtInfo.count === Math.round(h * 2);
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.durationBtn, active && styles.durationBtnActive]}
                  onPress={() => applyDuration(h)}
                  disabled={busy}>
                  <Text style={[styles.durationBtnText, active && styles.durationBtnTextActive]}>
                    {h === 1.5 ? '1.5 ч' : `${h} ч`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={styles.cancelSelectBtn}
              onPress={() => setSelection(null)}
              disabled={busy}>
              <Text style={styles.cancelSelectText}>×</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, busy && styles.disabled]}
              onPress={confirmBooking}
              disabled={busy}>
              <Text style={styles.confirmText}>
                {busy
                  ? '...'
                  : `Забронировать ${selectedCourtInfo.count * 0.5} ч${selectedCourtInfo.price != null ? ` · ${selectedCourtInfo.price} ₽` : ''}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            ref={hScrollRef}
            onLayout={scrollToNow}>
            <View>
              {/* Header row: time labels */}
              <View style={styles.headerRow}>
                <View style={[styles.cornerCell, {width: ROW_LABEL_W}]}>
                  <Text style={styles.cornerText}>Корт / Время</Text>
                </View>
                {timeLabels.map(t => {
                  const isHourMark = t.endsWith(':00');
                  const isNow = isCurrentSlot(t);
                  return (
                    <View
                      key={t}
                      style={[
                        styles.headerCell,
                        {width: SLOT_W},
                        isHourMark && styles.hourMark,
                        isNow && styles.nowCell,
                      ]}>
                      <Text
                        style={[
                          styles.headerText,
                          isHourMark && styles.headerTextBold,
                          isNow && styles.nowText,
                        ]}>
                        {isNow ? '● ' : ''}{t}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Court rows */}
              {filteredCourts.map(court => (
                <View key={court.court_id} style={styles.courtRow}>
                  <View style={[styles.courtLabel, {width: ROW_LABEL_W}]}>
                    <Text style={styles.courtLabelSport}>
                      {court.sport === 'padel' ? '🥎' : '🎾'}
                    </Text>
                    <Text style={styles.courtLabelText} numberOfLines={2}>
                      {court.court_name}
                    </Text>
                    {court.price_per_slot != null && (
                      <Text style={styles.courtPrice}>{court.price_per_slot} ₽/30м</Text>
                    )}
                    {court.is_singles_only && (
                      <Text style={styles.courtTag}>1×1</Text>
                    )}
                  </View>
                  {court.slots.map((slot, idx) => {
                    const sel = isInSelection(court.court_id, idx);
                    const isHourMark = slot.slot_start.endsWith(':00');
                    const bg = slotColor(slot, sel);
                    const isFree = slot.status === 'free' && !sel;
                    const isMine = slot.status === 'mine';
                    const isBooked = slot.status === 'booked';
                    return (
                      <TouchableOpacity
                        key={slot.slot_start}
                        style={[
                          styles.slot,
                          {
                            width: SLOT_W,
                            backgroundColor: bg,
                            opacity: busy ? 0.6 : 1,
                          },
                          isHourMark && styles.hourMarkSlot,
                          sel && styles.selectedBorder,
                        ]}
                        activeOpacity={0.6}
                        onPress={() => handleSlotTap(court, slot, idx)}
                        disabled={busy}>
                        <Text
                          style={[
                            styles.slotTime,
                            isFree && styles.slotTimeFree,
                            (isMine || isBooked || sel) && styles.slotTimeDark,
                          ]}>
                          {slot.slot_start}
                        </Text>
                        {isMine && <Text style={styles.slotStatusIcon}>✓</Text>}
                        {isBooked && <Text style={styles.slotStatusIcon}>✕</Text>}
                        {isFree && <Text style={styles.slotFreeIcon}>○</Text>}
                        {sel && !isMine && !isBooked && (
                          <Text style={styles.slotStatusIcon}>●</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              {filteredCourts.length === 0 && (
                <Text style={styles.empty}>Нет кортов для выбранных фильтров</Text>
              )}
            </View>
          </ScrollView>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, {backgroundColor: C_MINE}]} />
              <Text style={styles.legendText}>Моя</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, {backgroundColor: C_BOOKED}]} />
              <Text style={styles.legendText}>Занято</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, {backgroundColor: C_FREE, borderWidth: 1, borderColor: C_FREE_BORDER}]} />
              <Text style={styles.legendText}>Свободно</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, {backgroundColor: C_SELECTED}]} />
              <Text style={styles.legendText}>Выбрано</Text>
            </View>
          </View>

          {!selection && (
            <Text style={styles.helpText}>
              Тап на свободный слот — начало. Второй тап — конец диапазона.
            </Text>
          )}
        </ScrollView>
      )}

      {/* Лёгкий оверлей при смене даты — не перекрывает весь экран */}
      {updating && !loading && (
        <View style={styles.updatingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  nowCell: {backgroundColor: '#FFF3E0'},
  nowText: {color: '#E65100', fontWeight: '700'},
  // Queue modal
  qmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  qmCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
  },
  qmTitle: {fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text},
  qmSubtitle: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2, marginBottom: SPACING.md},
  qmLabel: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs},
  qmDurationRow: {flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm},
  qmDurBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  qmDurBtnActive: {backgroundColor: COLORS.primary},
  qmDurText: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary},
  qmDurTextActive: {color: COLORS.textLight},
  qmInterval: {fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.primary, marginBottom: SPACING.sm},
  qmSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginVertical: SPACING.xs,
  },
  qmSwitchLabel: {fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text},
  qmHint: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 1},
  qmActions: {flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md},
  qmCancelBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  qmCancelText: {fontSize: FONT_SIZE.md, color: COLORS.textSecondary, fontWeight: '600'},
  qmJoinBtn: {
    flex: 2,
    paddingVertical: SPACING.md,
    borderRadius: 10,
    backgroundColor: '#FF9800',
    alignItems: 'center',
  },
  qmJoinText: {fontSize: FONT_SIZE.md, color: '#fff', fontWeight: '700'},
  container: {flex: 1, backgroundColor: COLORS.background},
  center: {flex: 1, marginTop: 60},
  updatingOverlay: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 10,
  },

  // Date header
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowBtnDisabled: {
    backgroundColor: COLORS.background,
  },
  arrowText: {
    fontSize: 24,
    color: COLORS.primary,
    fontWeight: '700',
    lineHeight: 28,
  },
  arrowTextDisabled: {
    color: COLORS.disabled,
  },
  dateLabelWrap: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabelMain: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  dateLabelSub: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // 14-day calendar strip
  calendarWrapper: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    height: 52,
  },
  calendarContent: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    gap: 4,
    alignItems: 'center',
  },
  calDay: {
    width: 38,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 4,
  },
  calDaySelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  calDayToday: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  calWeekday: {
    fontSize: 9,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  calDayNum: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 1,
  },
  calTextSelected: {
    color: COLORS.textLight,
  },
  calTodayText: {
    color: COLORS.primary,
  },
  calDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginTop: 1,
  },
  calDotSelected: {
    backgroundColor: COLORS.textLight,
  },

  // Filters — single horizontal ScrollView row
  filtersWrapper: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filtersContent: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    alignItems: 'center',
    gap: 6,
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.xs,
  },
  filterBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  filterText: {fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.text},
  filterTextActive: {color: COLORS.textLight},

  // Action bar (booking button)
  actionBarWrapper: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.md,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    gap: SPACING.xs,
  },
  durationLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginRight: SPACING.xs,
  },
  durationBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  durationBtnActive: {
    backgroundColor: COLORS.primary,
  },
  durationBtnText: {fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.primary},
  durationBtnTextActive: {color: COLORS.textLight},
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  cancelSelectBtn: {
    width: 40,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#FFE0B2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelSelectText: {fontSize: 22, color: '#E65100', fontWeight: '700'},
  confirmBtn: {
    flex: 1,
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  confirmText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
  },
  disabled: {opacity: 0.5},

  // Grid header
  headerRow: {flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border},
  cornerCell: {
    height: 32,
    backgroundColor: COLORS.background,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cornerText: {fontSize: 9, color: COLORS.textSecondary},
  headerCell: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  hourMark: {
    backgroundColor: '#E0E0E0',
    borderRightColor: COLORS.text,
  },
  headerText: {fontSize: 9, color: COLORS.textSecondary},
  headerTextBold: {fontWeight: '800', color: COLORS.text, fontSize: 10},

  // Court rows
  courtRow: {flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border},
  courtLabel: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    minHeight: SLOT_H,
  },
  courtLabelSport: {
    fontSize: 11,
    marginBottom: 1,
  },
  courtLabelText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    flexWrap: 'wrap',
  },
  courtPrice: {fontSize: 10, color: COLORS.textSecondary, marginTop: 2},
  courtTag: {
    fontSize: 9,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 2,
  },

  // Slots
  slot: {
    height: SLOT_H,
    borderRightWidth: 1,
    borderRightColor: C_FREE_BORDER,
    borderBottomWidth: 1,
    borderBottomColor: C_FREE_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hourMarkSlot: {borderRightWidth: 2, borderRightColor: 'rgba(0,0,0,0.15)'},
  selectedBorder: {borderWidth: 1.5, borderColor: '#E65100'},
  slotTime: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
  },
  slotTimeFree: {
    color: COLORS.textSecondary,
    fontWeight: '400',
  },
  slotTimeDark: {
    color: COLORS.textLight,
    fontWeight: '700',
  },
  slotStatusIcon: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: '700',
    lineHeight: 16,
  },
  slotFreeIcon: {
    fontSize: 11,
    color: COLORS.textSecondary,
    opacity: 0.3,
    lineHeight: 14,
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  empty: {
    padding: SPACING.lg,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: FONT_SIZE.md,
  },
  helpText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
});
