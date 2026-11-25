import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS} from '../../constants/theme';
import {CourtTransferStackParamList} from '../../navigation/MainTabNavigator';
import {bookingsApi} from '../../api/bookings';
import {queueApi} from '../../api/queue';
import {courtTransferApi} from '../../api/feed';
import {BookingResponse} from '../../types/booking';
import {QueueEntry} from '../../types/queue';
import {SkeletonList} from '../../components/common/Skeleton';
import {CourtTransfer} from '../../types/feed';

type Nav = NativeStackNavigationProp<CourtTransferStackParamList>;

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string, timeStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year} · ${timeStr}`;
  } catch {
    return `${dateStr} ${timeStr}`;
  }
}

function formatTransferTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month} ${hours}:${mins}`;
  } catch {
    return isoStr;
  }
}

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Ожидание',
  notified: 'Уведомлён',
  booked: 'Забронировано',
  cancelled: 'Отменено',
};

// ─── sub-components ──────────────────────────────────────────────────────────

// Группа смежных слотов одной брони: 16:00,16:30,17:00,17:30 → «16:00–18:00»
export interface BookingGroup {
  ids: string[];
  court_id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_name?: string;
  location_name?: string;
  location_id?: string;
}

export function groupBookings(items: BookingResponse[]): BookingGroup[] {
  const sorted = [...items].sort((a, b) =>
    a.court_id === b.court_id
      ? a.date === b.date
        ? a.slot_start.localeCompare(b.slot_start)
        : a.date.localeCompare(b.date)
      : a.court_id.localeCompare(b.court_id),
  );
  const groups: BookingGroup[] = [];
  for (const b of sorted) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.court_id === b.court_id &&
      last.date === b.date &&
      last.slot_end === b.slot_start
    ) {
      last.slot_end = b.slot_end;
      last.ids.push(b.id);
    } else {
      groups.push({
        ids: [b.id],
        court_id: b.court_id,
        date: b.date,
        slot_start: b.slot_start,
        slot_end: b.slot_end,
        court_name: b.court_name,
        location_name: b.location_name,
        location_id: b.location_id,
      });
    }
  }
  // Сортируем группы по дате и времени
  return groups.sort((a, b) =>
    a.date === b.date ? a.slot_start.localeCompare(b.slot_start) : a.date.localeCompare(b.date),
  );
}

interface BookingCardProps {
  item: BookingGroup;
  onCancel: (group: BookingGroup) => void;
}

function BookingCard({item, onCancel}: BookingCardProps) {
  const placeLabel = [item.location_name, item.court_name].filter(Boolean).join(' · ');
  return (
    <View style={styles.bookingCard}>
      <View style={styles.bookingBorder} />
      <View style={styles.bookingContent}>
        <Text style={styles.bookingDateTime}>
          {formatDateTime(item.date, `${item.slot_start} – ${item.slot_end}`)}
        </Text>
        {!!placeLabel && (
          <Text style={styles.bookingCourtId}>{placeLabel}</Text>
        )}
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => onCancel(item)}>
          <Text style={styles.cancelBtnText}>Отменить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface QueueCardProps {
  item: QueueEntry;
  onLeave: (id: string) => void;
}

function QueueCard({item, onLeave}: QueueCardProps) {
  const borderColor =
    item.status === 'notified' ? COLORS.error : '#FF9800';

  const courtLabel = item.any_court
    ? `${item.location_name ?? 'Локация'} · любой корт`
    : item.court_name ?? '';
  const timeLabel = item.slot_end
    ? `${item.slot_start}–${item.slot_end}${item.min_duration ? ` (мин. ${item.min_duration} мин)` : ''}`
    : item.slot_start;

  return (
    <View style={[styles.queueCard, {borderLeftColor: borderColor}]}>
      <View style={styles.queueContent}>
        <Text style={styles.queueDateTime}>
          {formatDateTime(item.date, timeLabel)}
        </Text>
        {!!courtLabel && (
          <Text style={{fontSize: 12, color: COLORS.textSecondary, marginTop: 2}}>
            {courtLabel}
          </Text>
        )}
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor:
                item.status === 'notified'
                  ? '#FFEBEE'
                  : '#FFF3E0',
            },
          ]}>
          <Text
            style={[
              styles.statusPillText,
              {
                color:
                  item.status === 'notified'
                    ? COLORS.error
                    : '#E65100',
              },
            ]}>
            {STATUS_LABEL[item.status] ?? item.status}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.leaveBtn}
        onPress={() => onLeave(item.id)}>
        <Text style={styles.leaveBtnText}>Выйти</Text>
      </TouchableOpacity>
    </View>
  );
}

interface TransferCardProps {
  item: CourtTransfer;
}

function TransferCard({item}: TransferCardProps) {
  return (
    <View style={styles.transferCard}>
      <Text style={styles.transferTime}>
        {formatTransferTime(item.start_time)} – {formatTransferTime(item.end_time)}
      </Text>
      <Text style={styles.transferNotes} numberOfLines={1}>
        {item.notes ?? (item.is_paid ? 'Платная передача' : 'Бесплатная передача')}
      </Text>
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function CourtsHomeScreen() {
  const navigation = useNavigation<Nav>();

  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [transfers, setTransfers] = useState<CourtTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [bRes, qRes, tRes] = await Promise.allSettled([
        bookingsApi.getMine(),
        queueApi.getMine(),
        courtTransferApi.getMine(),
      ]);

      if (bRes.status === 'fulfilled') {
        setBookings(bRes.value.data ?? []);
      }
      if (qRes.status === 'fulfilled') {
        setQueue(
          (qRes.value.data ?? []).filter(
            e => e.status === 'waiting' || e.status === 'notified',
          ),
        );
      }
      if (tRes.status === 'fulfilled') {
        setTransfers(tRes.value.data ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const handleCancelBooking = useCallback((group: BookingGroup) => {
    Alert.alert(
      'Отменить бронь?',
      `${group.slot_start} – ${group.slot_end}${group.court_name ? ` · ${group.court_name}` : ''}`,
      [
        {text: 'Нет', style: 'cancel'},
        {
          text: 'Отменить бронь',
          style: 'destructive',
          onPress: async () => {
            try {
              // Отменяем все слоты группы
              for (const id of group.ids) {
                await bookingsApi.cancel(id);
              }
              setBookings(prev => prev.filter(b => !group.ids.includes(b.id)));
            } catch {
              // user can refresh
            }
          },
        },
      ],
    );
  }, []);

  const handleLeaveQueue = useCallback(async (id: string) => {
    try {
      await queueApi.leave(id);
      setQueue(prev => prev.filter(e => e.id !== id));
    } catch {
      // silently ignore
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.root}>
        <SkeletonList count={4} />
      </View>
    );
  }

  const last2Transfers = transfers.slice(0, 2);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }>
      {/* ── Шапка ───────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Корты</Text>
        <TouchableOpacity
          style={styles.gridBtn}
          onPress={() => navigation.navigate('LocationList')}>
          <Text style={styles.gridBtnText}>🗓 Шахматка</Text>
        </TouchableOpacity>
      </View>

      {/* ── Мои брони ───────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Мои брони</Text>
        {bookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>Нет активных броней</Text>
            <Text style={styles.emptyHint}>
              Забронируй корт в шахматке
            </Text>
          </View>
        ) : (
          <FlatList
            data={groupBookings(bookings)}
            keyExtractor={item => item.ids[0]}
            renderItem={({item}) => (
              <BookingCard item={item} onCancel={handleCancelBooking} />
            )}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hList}
            scrollEnabled={bookings.length > 1}
          />
        )}
      </View>

      {/* ── Моя очередь ─────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>⏳ Моя очередь</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MyQueue' as any)}>
            <Text style={styles.seeAll}>Все →</Text>
          </TouchableOpacity>
        </View>
        {queue.length > 0 ? (
          <FlatList
            data={queue}
            keyExtractor={item => item.id}
            renderItem={({item}) => (
              <QueueCard item={item} onLeave={handleLeaveQueue} />
            )}
            scrollEnabled={false}
          />
        ) : (
          <Text style={styles.transferEmpty}>
            Вы не в очереди. Занятый слот в шахматке → «Встать в очередь»
          </Text>
        )}
      </View>

      {/* ── Передача корта ──────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Передача корта</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('MyCourtTransfers')}>
            <Text style={styles.seeAll}>Все →</Text>
          </TouchableOpacity>
        </View>
        {last2Transfers.length > 0 ? (
          last2Transfers.map(t => <TransferCard key={t.id} item={t} />)
        ) : (
          <Text style={styles.transferEmpty}>Нет активных передач</Text>
        )}
      </View>

      {/* ── Забронировать корт ──────────────────────────────── */}
      <TouchableOpacity
        style={styles.bookBtn}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('LocationList')}>
        <Text style={styles.bookBtnText}>Забронировать корт</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F7F5',
  },
  content: {
    paddingBottom: SPACING.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7F5',
  },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  gridBtn: {
    backgroundColor: COLORS.primaryGhost,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
  },
  gridBtnText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // section
  section: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  seeAll: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // horizontal list
  hList: {
    paddingRight: SPACING.md,
    gap: SPACING.sm,
  },

  // booking card
  bookingCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    ...SHADOWS.sm,
    overflow: 'hidden',
    width: 200,
    marginRight: SPACING.sm,
  },
  bookingBorder: {
    width: 4,
    backgroundColor: '#2E7D32',
  },
  bookingContent: {
    flex: 1,
    padding: SPACING.sm,
  },
  bookingDateTime: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  bookingCourtId: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: RADIUS.sm,
    paddingVertical: 3,
    paddingHorizontal: SPACING.sm,
    alignSelf: 'flex-start',
  },
  cancelBtnText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    fontWeight: '600',
  },

  // empty booking card
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    ...SHADOWS.sm,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // queue card
  queueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderLeftWidth: 4,
    ...SHADOWS.sm,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
  },
  queueContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  queueDateTime: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  statusPillText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  leaveBtn: {
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
  },
  leaveBtnText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    fontWeight: '600',
  },

  // transfer card
  transferCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    ...SHADOWS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  transferTime: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  transferNotes: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  transferEmpty: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },

  // book button
  bookBtn: {
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  bookBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textLight,
  },
});
