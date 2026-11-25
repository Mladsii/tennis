import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {searchApi} from '../../api/search';
import {usersApi} from '../../api/users';
import {SearchRequest} from '../../types/search';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {formatDate, formatDateTime, formatTime, extractErrorMessage} from '../../utils/format';
import {GAME_TYPE_LABELS} from '../../constants/levels';
import {handlePremiumError} from '../../utils/premiumError';

type Tab = 'mine' | 'available';
type DateFilter = 'any' | 'today' | 'tomorrow' | 'week';
type GameTypeFilter = 'all' | 'singles' | 'doubles';

const DATE_FILTERS: {label: string; value: DateFilter}[] = [
  {label: 'Любая', value: 'any'},
  {label: 'Сегодня', value: 'today'},
  {label: 'Завтра', value: 'tomorrow'},
  {label: 'Неделя', value: 'week'},
];

const GAME_TYPE_FILTERS: {label: string; value: GameTypeFilter}[] = [
  {label: 'Все', value: 'all'},
  {label: '1×1', value: 'singles'},
  {label: '2×2', value: 'doubles'},
];

function isoDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function ConfirmedGameBanner({game, navigation}: {game: SearchRequest; navigation: any}) {
  const now = new Date();
  const start = new Date(game.start_time);
  const end = new Date(game.end_time);
  const gameEnded = end < now;
  const isSoon = !gameEnded && start.getTime() - now.getTime() < 3 * 60 * 60 * 1000;
  const isToday = start.toDateString() === now.toDateString();

  const dateStr = isToday
    ? 'Сегодня'
    : start.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'});
  const timeStr = start.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});

  const openDetail = () =>
    navigation.navigate('SearchRequestDetail', {id: game.id});

  return (
    <TouchableOpacity
      style={[styles.gameBanner, gameEnded && styles.gameBannerEnded, isSoon && styles.gameBannerSoon]}
      activeOpacity={0.85}
      onPress={openDetail}>
      <View style={styles.gameBannerRow}>
        <Text style={styles.gameBannerIcon}>{gameEnded ? '⏱️' : isSoon ? '🔔' : '🎾'}</Text>
        <View style={styles.gameBannerContent}>
          <Text style={styles.gameBannerTitle}>
            {gameEnded ? 'Игра завершена' : isSoon ? 'Скоро игра!' : 'Игра подтверждена'}
          </Text>
          <Text style={styles.gameBannerSub}>
            {GAME_TYPE_LABELS[game.game_type] ?? game.game_type}
            {(game.location_name || game.court_name)
              ? `  ·  ${[game.location_name, game.court_name].filter(Boolean).join(' · ')}`
              : ''}
          </Text>
          <Text style={[styles.gameBannerTime, isSoon && styles.gameBannerTimeSoon]}>
            {dateStr}, {timeStr}
          </Text>
        </View>
        <Text style={styles.gameBannerChevron}>›</Text>
      </View>
      {gameEnded && (
        <TouchableOpacity style={styles.scoreBannerBtn} onPress={openDetail}>
          <Text style={styles.scoreBannerBtnText}>🏆 Записать счёт игры</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function MySearchesScreen({navigation}: any) {
  const [tab, setTab] = useState<Tab>('available');
  const [mine, setMine] = useState<SearchRequest[]>([]);
  const [available, setAvailable] = useState<SearchRequest[]>([]);
  const [confirmedGames, setConfirmedGames] = useState<SearchRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('any');
  const [gameTypeFilter, setGameTypeFilter] = useState<GameTypeFilter>('all');
  const [openDateOnly, setOpenDateOnly] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mineRes, availRes] = await Promise.all([
        searchApi.getMine(),
        searchApi.getAvailable(),
      ]);
      // Просроченные поиски без подтверждённого партнёра скрываем
      const now = Date.now();
      const notExpired = (s: SearchRequest) =>
        s.open_date ||
        (s.confirmed_count ?? 0) > 0 ||
        new Date(s.end_time).getTime() > now;
      setMine(mineRes.data.filter(notExpired));
      setAvailable(availRes.data);
      // Подтверждённые игры — есть партнёр, не open_date
      const confirmed = mineRes.data
        .filter(s => (s.confirmed_count ?? 0) > 0 && !s.open_date)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      setConfirmedGames(confirmed);
    } catch {}
  }, []);

  const handleQuickSearch = useCallback(async () => {
    setQuickLoading(true);
    try {
      const {data: me} = await usersApi.getMe();
      const now = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 7);
      end.setHours(23, 30, 0, 0);
      const pad = (n: number) => String(n).padStart(2, '0');
      const iso = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
      await searchApi.create({
        game_type: 'singles',
        court_booked: false,
        stm_level: me.stm_level || undefined,
        start_time: iso(now),
        end_time: iso(end),
        only_preferred: false,
        open_date: true,
        notes: 'Быстрый поиск: ищу партнёра на неделю',
      });
      Alert.alert('⚡ Готово', 'Быстрый поиск создан на неделю. Партнёров ждём в откликах!');
      load();
    } catch (e: any) {
      if (!handlePremiumError(e, navigation)) {
        Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось создать быстрый поиск'));
      }
    } finally {
      setQuickLoading(false);
    }
  }, [load, navigation]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filteredAvailable = useMemo(() => {
    // В "Доступных" не показываем уже закрытые (партнёр найден)
    let items = available.filter(i => i.is_active);

    // game type filter
    if (gameTypeFilter !== 'all') {
      items = items.filter(i => i.game_type === gameTypeFilter);
    }

    // open date toggle
    if (openDateOnly) {
      items = items.filter(i => i.open_date);
      return items;
    }

    // date filter
    if (dateFilter !== 'any') {
      const today = isoDateStr(0);
      const tomorrow = isoDateStr(1);
      const weekEnd = isoDateStr(7);
      items = items.filter(i => {
        if (i.open_date) return true; // open-date requests match any date filter
        const d = i.start_time?.slice(0, 10) ?? '';
        if (dateFilter === 'today') return d === today;
        if (dateFilter === 'tomorrow') return d === tomorrow;
        if (dateFilter === 'week') return d >= today && d <= weekEnd;
        return true;
      });
    }

    return items;
  }, [available, dateFilter, gameTypeFilter, openDateOnly]);

  const items = tab === 'mine' ? mine : filteredAvailable;

  const renderItem = ({item}: {item: SearchRequest}) => {
    const pending = item.pending_count ?? 0;
    const total = item.responses_count ?? 0;
    const hasConfirmed = (item.confirmed_count ?? 0) > 0;
    const isFull = hasConfirmed && !item.is_active;
    const myStatusLabels: Record<string, string> = {
      pending: 'Вы откликнулись',
      confirmed: '✅ Подтверждён',
      declined: 'Отказ',
      reset: 'Сброшен',
    };
    return (
      <TouchableOpacity
        style={[
          styles.card,
          hasConfirmed && styles.cardConfirmed,
          isFull && styles.cardFull,
        ]}
        onPress={() => navigation.navigate('SearchRequestDetail', {id: item.id})}>
        <View style={styles.cardHeader}>
          <Text style={styles.gameType}>
            {GAME_TYPE_LABELS[item.game_type] || item.game_type}
          </Text>
          <View style={styles.cardHeaderRight}>
            {tab === 'mine' && pending > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pending} нов.</Text>
              </View>
            )}
            {isFull ? (
              <View style={styles.foundBadge}>
                <Text style={styles.foundBadgeText}>✅ Найден</Text>
              </View>
            ) : hasConfirmed ? (
              <Text style={styles.statusConfirmed}>
                ✅ {item.confirmed_count}/{item.max_players}
              </Text>
            ) : (
              <Text style={[styles.status, !item.is_active && styles.inactive]}>
                {item.is_active ? `${item.confirmed_count}/${item.max_players}` : 'Закрыт'}
              </Text>
            )}
          </View>
        </View>
        {tab === 'available' && item.author && (
          <Text style={styles.author}>
            {item.author.last_name} {item.author.first_name} (СТМ {item.author.stm_level})
          </Text>
        )}
        {item.open_date ? (
          <Text style={styles.openDate}>📅 Открытая дата</Text>
        ) : (
          <Text style={styles.time}>
            {formatDate(item.start_time)}, {formatTime(item.start_time)} — {formatTime(item.end_time)}
          </Text>
        )}
        {item.court_booked && <Text style={styles.booked}>Корт забронирован</Text>}
        {tab === 'mine' && total > 0 && (
          <Text style={styles.respCount}>Откликов: {total}</Text>
        )}
        {tab === 'available' && item.has_my_response && item.my_response_status && (
          <Text style={styles.myResp}>
            {myStatusLabels[item.my_response_status] || item.my_response_status}
          </Text>
        )}
        <Text style={styles.date}>{formatDateTime(item.created_at)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Баннеры подтверждённых игр */}
      {confirmedGames.map(game => (
        <ConfirmedGameBanner key={game.id} game={game} navigation={navigation} />
      ))}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'available' && styles.tabActive]}
          onPress={() => setTab('available')}>
          <Text style={[styles.tabText, tab === 'available' && styles.tabTextActive]}>
            Доступные
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'mine' && styles.tabActive]}
          onPress={() => setTab('mine')}>
          <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>
            Мои
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters for "available" tab */}
      {tab === 'available' && (
        <View style={styles.filterBox}>
          {/* Game type row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {GAME_TYPE_FILTERS.map(f => (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, gameTypeFilter === f.value && styles.chipActive]}
                onPress={() => setGameTypeFilter(f.value)}>
                <Text style={[styles.chipText, gameTypeFilter === f.value && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.chipDivider} />
            {/* Open date toggle */}
            <TouchableOpacity
              style={[styles.chip, openDateOnly && styles.chipActive]}
              onPress={() => { setOpenDateOnly(v => !v); setDateFilter('any'); }}>
              <Text style={[styles.chipText, openDateOnly && styles.chipTextActive]}>
                📅 Гибкая дата
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Date row — hidden when open-date-only */}
          {!openDateOnly && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {DATE_FILTERS.map(f => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.chip, dateFilter === f.value && styles.chipActive]}
                  onPress={() => setDateFilter(f.value)}>
                  <Text style={[styles.chipText, dateFilter === f.value && styles.chipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Active filter summary */}
          {(gameTypeFilter !== 'all' || dateFilter !== 'any' || openDateOnly) && (
            <View style={styles.filterSummaryRow}>
              <Text style={styles.filterSummary}>
                Найдено: {filteredAvailable.length}
              </Text>
              <TouchableOpacity onPress={() => {
                setGameTypeFilter('all');
                setDateFilter('any');
                setOpenDateOnly(false);
              }}>
                <Text style={styles.filterReset}>Сбросить</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.empty}>
              {tab === 'mine' ? 'У вас ещё нет поисков' : 'Нет активных запросов от других игроков'}
            </Text>
            {tab === 'mine' && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('CreateSearch')}>
                <Text style={styles.emptyBtnText}>+ Создать поиск</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fabQuick}
        onPress={handleQuickSearch}
        disabled={quickLoading}>
        {quickLoading ? (
          <ActivityIndicator color={COLORS.textLight} />
        ) : (
          <Text style={styles.fabQuickText}>⚡</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateSearch')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {borderBottomColor: COLORS.primary},
  tabText: {fontSize: FONT_SIZE.md, color: COLORS.textSecondary},
  tabTextActive: {color: COLORS.primary, fontWeight: '600'},

  filterBox: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: SPACING.xs,
  },
  filterRow: {paddingHorizontal: SPACING.sm, marginBottom: 4},
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    marginRight: SPACING.xs,
    alignSelf: 'flex-start',
  },
  chipActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  chipText: {fontSize: FONT_SIZE.xs, color: COLORS.text, fontWeight: '600'},
  chipTextActive: {color: COLORS.textLight},
  chipDivider: {width: 1, backgroundColor: COLORS.border, marginHorizontal: 4, alignSelf: 'stretch'},
  filterSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingTop: 4,
  },
  filterSummary: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary},
  filterReset: {fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '600'},

  list: {padding: SPACING.sm},
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardHeaderRight: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm},
  badge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {color: COLORS.textLight, fontSize: FONT_SIZE.xs, fontWeight: '700'},
  gameType: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary},
  status: {fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.success},
  inactive: {color: COLORS.disabled},
  author: {fontSize: FONT_SIZE.sm, color: COLORS.text, marginBottom: 4},
  time: {fontSize: FONT_SIZE.md, color: COLORS.text},
  openDate: {fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '600'},
  booked: {fontSize: FONT_SIZE.sm, color: COLORS.secondary, marginTop: 2},
  respCount: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2},
  myResp: {fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '600', marginTop: 2},
  date: {fontSize: FONT_SIZE.xs, color: COLORS.disabled, marginTop: 4},
  emptyContainer: {alignItems: 'center', marginTop: SPACING.xl, paddingHorizontal: SPACING.lg},
  empty: {textAlign: 'center', color: COLORS.textSecondary, marginBottom: SPACING.md},
  emptyBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    borderRadius: 24,
    marginTop: SPACING.sm,
  },
  emptyBtnText: {color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md},
  // Баннеры подтверждённых игр
  gameBanner: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#43A047',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  gameBannerEnded: {backgroundColor: '#FFFDE7', borderLeftColor: '#FF8F00'},
  gameBannerSoon: {backgroundColor: '#FFF3F3', borderLeftColor: '#E53935'},
  gameBannerRow: {flexDirection: 'row', alignItems: 'center'},
  gameBannerIcon: {fontSize: 24, marginRight: SPACING.sm},
  gameBannerContent: {flex: 1},
  gameBannerTitle: {fontSize: FONT_SIZE.sm, fontWeight: '700', color: '#1B5E20'},
  gameBannerSub: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 1},
  gameBannerTime: {fontSize: FONT_SIZE.sm, fontWeight: '700', color: '#212121', marginTop: 2},
  gameBannerTimeSoon: {color: '#E53935'},
  gameBannerChevron: {fontSize: 22, color: COLORS.disabled, marginLeft: SPACING.sm},
  scoreBannerBtn: {
    marginTop: SPACING.sm,
    backgroundColor: '#FF8F00',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  scoreBannerBtnText: {color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm},
  fab: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {fontSize: 28, color: COLORS.textLight, marginTop: -2},
  fabQuick: {
    position: 'absolute',
    bottom: SPACING.lg + 68,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabQuickText: {fontSize: 26, color: COLORS.textLight},
  // Confirmed / found state
  cardConfirmed: {
    borderWidth: 1.5,
    borderColor: COLORS.success,
    backgroundColor: '#F1FBF3',
  },
  cardFull: {
    borderWidth: 1.5,
    borderColor: COLORS.success,
    backgroundColor: '#E8F5E9',
  },
  statusConfirmed: {fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.success},
  foundBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  foundBadgeText: {color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: '700'},
});
