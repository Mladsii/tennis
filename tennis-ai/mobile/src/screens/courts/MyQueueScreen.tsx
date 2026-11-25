import React, {useCallback, useState} from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {queueApi} from '../../api/queue';
import {QueueEntry} from '../../types/queue';
import {COLORS, FONT_SIZE, SPACING, SHADOWS, RADIUS} from '../../constants/theme';
import {SkeletonList} from '../../components/common/Skeleton';
import SwipeToCancel from '../../components/common/SwipeToCancel';

// ─── Карточка очереди ─────────────────────────────────────────────────────────
const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function formatRuDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const today = new Date();
  const target = new Date(y, m - 1, d);
  const diffDays = Math.round((target.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Завтра';
  return `${d} ${RU_MONTHS[m - 1]}`;
}

function QueueCard({
  item,
  onLeave,
  onBook,
}: {
  item: QueueEntry;
  onLeave: (entry: QueueEntry) => void;
  onBook: (entry: QueueEntry) => void;
}) {
  const isNotified = item.status === 'notified';

  const timeLabel = item.slot_end
    ? `${item.slot_start} – ${item.slot_end}`
    : item.slot_start;
  const placeLabel = item.any_court
    ? `${item.location_name ?? 'Локация'} · любой корт`
    : [item.location_name, item.court_name].filter(Boolean).join(' · ');

  return (
    <SwipeToCancel onDelete={() => onLeave(item)} actionLabel="Выйти" style={{marginBottom: 12}}>
    <View style={[styles.card, {marginBottom: 0}]}>
      {/* Верхняя строка: пилюля статуса + кнопка выйти */}
      <View style={styles.cardTop}>
        <View
          style={[
            styles.statusPill,
            isNotified ? styles.statusPillNotified : styles.statusPillQueued,
          ]}>
          <Text
            style={[
              styles.statusPillText,
              isNotified
                ? styles.statusPillTextNotified
                : styles.statusPillTextQueued,
            ]}>
            {isNotified ? '🔔 Корт свободен' : 'В очереди'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.leaveBtn}
          activeOpacity={0.75}
          onPress={() => onLeave(item)}>
          <Text style={styles.leaveBtnText}>Выйти</Text>
        </TouchableOpacity>
      </View>

      {/* Дата и интервал */}
      <Text style={styles.dateText}>
        {formatRuDate(item.date)} · {timeLabel}
      </Text>
      {!!placeLabel && <Text style={styles.placeText}>{placeLabel}</Text>}
      {!!item.min_duration && item.slot_end && (
        <Text style={styles.minDurText}>Минимум игры: {item.min_duration} мин</Text>
      )}

      {/* Кнопка бронирования при уведомлении */}
      {isNotified && (
        <TouchableOpacity style={styles.bookBtn} onPress={() => onBook(item)}>
          <Text style={styles.bookBtnText}>🎾 Забронировать сейчас</Text>
        </TouchableOpacity>
      )}
    </View>
    </SwipeToCancel>
  );
}

// ─── Основной экран ───────────────────────────────────────────────────────────
export default function MyQueueScreen({navigation}: any) {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleBook = (entry: QueueEntry) => {
    if (entry.location_id) {
      navigation.navigate('CourtGrid', {
        locationId: entry.location_id,
        locationName: entry.location_name ?? 'Корты',
      });
    } else {
      navigation.navigate('CourtsHome');
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await queueApi.getMine();
      setEntries(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleLeave = (entry: QueueEntry) => {
    Alert.alert(
      'Выйти из очереди?',
      `${formatRuDate(entry.date)} · ${entry.slot_start}${entry.slot_end ? `–${entry.slot_end}` : ''}`,
      [
        {text: 'Отмена', style: 'cancel'},
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: async () => {
            try {
              await queueApi.leave(entry.id);
              setEntries(prev => prev.filter(e => e.id !== entry.id));
            } catch {
              Alert.alert('Ошибка', 'Не удалось выйти из очереди');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <SkeletonList count={3} />
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>⏳</Text>
        <Text style={styles.emptyTitle}>Очередей нет</Text>
        <Text style={styles.emptySubtitle}>
          Встаньте в очередь на занятый слот в шахматке корта
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Шапка с счётчиком */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Моя очередь{' '}
          <Text style={styles.headerCounter}>({entries.length})</Text>
        </Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={e => e.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        renderItem={({item}) => (
          <QueueCard item={item} onLeave={handleLeave} onBook={handleBook} />
        )}
      />
    </View>
  );
}

// ─── Стили ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F7F5',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7F5',
  },

  /* Пустой экран */
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    backgroundColor: '#F5F7F5',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Шапка */
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerCounter: {
    fontWeight: '400',
    color: COLORS.textSecondary,
  },

  /* Список */
  list: {flex: 1},
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
  },

  /* Карточка */
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: 12,
    overflow: 'hidden',
    ...SHADOWS.sm,
    elevation: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  /* Статус-пилюля */
  statusPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusPillQueued: {
    backgroundColor: COLORS.primaryGhost,
  },
  statusPillNotified: {
    backgroundColor: '#FFF8E1',
  },
  statusPillText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  statusPillTextQueued: {
    color: COLORS.primary,
  },
  statusPillTextNotified: {
    color: '#F59E0B',
  },

  /* Дата */
  dateText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },

  /* Кнопка выйти */
  leaveBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.danger,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  leaveBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.danger,
  },

  placeText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  minDurText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  bookBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  bookBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: '#fff',
  },
});
