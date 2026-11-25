import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {feedApi} from '../../api/feed';
import {usersApi} from '../../api/users';
import {searchApi} from '../../api/search';
import {useAuthStore} from '../../store/authStore';
import {Notification} from '../../types/feed';
import {SearchRequest} from '../../types/search';
import {UserSettings} from '../../types/user';
import {COLORS, FONT_SIZE} from '../../constants/theme';
import {formatDateTime} from '../../utils/format';
import {playNotificationSound, soundKeyForNotificationType} from '../../utils/sound';

const TYPE_ICONS: Record<string, string> = {
  search_request: '🔍',
  search_response: '✋',
  search_confirmed: '✅',
  search_declined: '❌',
  search_reset: '🔄',
  court_transfer: '🏟️',
  player_request: '👤',
  player_request_accepted: '🤝',
  match_set_pending: '🎾',
  match_set_confirmed: '🏆',
  match_set_declined: '⛔',
};

const GAME_TYPE_LABELS: Record<string, string> = {
  singles: 'Одиночная игра',
  doubles: 'Парная игра',
  mixed: 'Смешанная пара',
  any: 'Любой формат',
};

const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const RU_WEEKDAYS = [
  'воскресенье', 'понедельник', 'вторник', 'среда',
  'четверг', 'пятница', 'суббота',
];

function getRussianDate(): string {
  const now = new Date();
  const day = now.getDate();
  const month = RU_MONTHS[now.getMonth()];
  const weekday = RU_WEEKDAYS[now.getDay()];
  return `${day} ${month}, ${weekday}`;
}

export default function ActivityFeedScreen({navigation}: any) {
  const user = useAuthStore(s => s.user);
  const [items, setItems] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeSearch, setActiveSearch] = useState<SearchRequest | null>(null);
  const settingsRef = useRef<UserSettings | null>(null);
  const seenIdsRef = useRef<Set<string> | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      const {data} = await feedApi.getFeed();
      if (seenIdsRef.current !== null) {
        const prev = seenIdsRef.current;
        const settings = settingsRef.current;
        const newItems = data.filter(n => !prev.has(n.id));
        if (settings) {
          const playedKeys = new Set<string>();
          for (const n of newItems) {
            const key = soundKeyForNotificationType(n.type);
            if (!key || playedKeys.has(key)) continue;
            const allowed =
              (key === 'search' && settings.sound_on_search) ||
              (key === 'booking' && settings.sound_on_booking) ||
              (key === 'player_request' && settings.sound_on_player_request);
            if (allowed) {
              playedKeys.add(key);
              playNotificationSound(key);
            }
          }
        }
      }
      seenIdsRef.current = new Set(data.map(n => n.id));
      setItems(data);
      const {data: unread} = await feedApi.getUnreadCount();
      setUnreadCount(unread.count);
    } catch {}
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      const {data: searches} = await searchApi.getMine();
      const found = searches.find(s => s.is_active) ?? null;
      setActiveSearch(found);
    } catch {}
  }, []);

  useEffect(() => {
    usersApi
      .getSettings()
      .then(({data}) => {
        settingsRef.current = data;
      })
      .catch(() => {});
    loadFeed();
    loadDashboardData();
  }, [loadFeed, loadDashboardData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadFeed();
      loadDashboardData();
    });
    return unsubscribe;
  }, [navigation, loadFeed, loadDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFeed(), loadDashboardData()]);
    setRefreshing(false);
  };

  const handleNotificationPress = async (item: Notification) => {
    if (!item.is_read) {
      try {
        await feedApi.markRead(item.id);
        setItems(prev =>
          prev.map(n => (n.id === item.id ? {...n, is_read: true} : n)),
        );
        setUnreadCount(c => Math.max(0, c - 1));
      } catch {}
    }
    if (item.reference_type === 'search_request' && item.reference_id) {
      navigation.navigate('SearchTab', {
        screen: 'SearchRequestDetail',
        params: {id: item.reference_id},
      });
    } else if (item.reference_type === 'search_response') {
      // Старые уведомления без id запроса — ведём в список поисков
      navigation.navigate('SearchTab', {screen: 'MySearches'});
    } else if (item.reference_type === 'court_transfer' && item.reference_id) {
      navigation.navigate('CourtsTab', {
        screen: 'CourtTransferDetail',
        params: {id: item.reference_id},
      });
    } else if (item.reference_type === 'match_set' && item.reference_id) {
      navigation.navigate('ProfileTab', {
        screen: 'MatchDetail',
        params: {id: item.reference_id},
      });
    } else if (item.reference_type === 'queue' || item.type === 'court_available') {
      // Корт освободился — ведём на сетку кортов (успеть забронировать)
      navigation.navigate('CourtsTab', {screen: 'CourtsHome'});
    } else if (item.reference_type === 'player_request') {
      navigation.navigate('ProfileTab', {screen: 'PreferredPlayers'});
    } else if (item.reference_type === 'competition' && item.reference_id) {
      navigation.navigate('ProfileTab', {
        screen: 'CompetitionDetail',
        params: {id: item.reference_id},
      });
    } else if (item.type === 'message' || item.reference_type === 'conversation') {
      navigation.navigate('ChatTab');
    } else if (item.type === 'premium') {
      navigation.navigate('ProfileTab', {screen: 'Profile'});
    }
  };

  const firstName = user?.first_name ?? 'Игрок';
  const recentItems = items.slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }>
      {/* Шапка */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerGreetRow}>
            <Text style={styles.headerGreet}>Привет, {firstName}! 👋</Text>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.unreadBadge}
              onPress={async () => {
                await feedApi.markAllRead();
                setItems(prev => prev.map(n => ({...n, is_read: true})));
                setUnreadCount(0);
              }}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.headerDate}>{getRussianDate()}</Text>
      </View>

      {/* Карточка активного поиска партнёра */}
      {activeSearch && (
        <TouchableOpacity
          style={styles.searchCard}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('SearchTab', {
              screen: 'SearchRequestDetail',
              params: {id: activeSearch.id},
            })
          }>
          <View style={styles.searchCardRow}>
            <Text style={styles.searchCardIcon}>🔍</Text>
            <View style={styles.searchCardContent}>
              <Text style={styles.searchCardTitle}>Активный поиск партнёра</Text>
              <Text style={styles.searchCardSub}>
                {GAME_TYPE_LABELS[activeSearch.game_type] ?? activeSearch.game_type}
              </Text>
              {activeSearch.court_booked && (activeSearch.location_name || activeSearch.court_name) ? (
                <Text style={styles.searchCardCourt} numberOfLines={1}>
                  🏟️ {[activeSearch.location_name, activeSearch.court_name].filter(Boolean).join(' · ')}
                  {activeSearch.booking_slot_start
                    ? `  ${activeSearch.booking_slot_start}–${activeSearch.booking_slot_end ?? '??'}`
                    : ''}
                </Text>
              ) : null}
              {activeSearch.start_time ? (
                <Text style={styles.searchCardTime}>
                  {formatDateTime(activeSearch.start_time)}
                </Text>
              ) : null}
            </View>
            <Text style={styles.searchCardChevron}>›</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Быстрые действия */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Быстрые действия</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() =>
              navigation.navigate('CourtsTab')
            }>
            <Text style={styles.actionEmoji}>🎾</Text>
            <Text style={styles.actionLabel}>Забронировать{'\n'}корт</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() =>
              navigation.navigate('SearchTab', {screen: 'CreateSearch'})
            }>
            <Text style={styles.actionEmoji}>🔍</Text>
            <Text style={styles.actionLabel}>Найти{'\n'}партнёра</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() =>
              navigation.navigate('ProfileTab', {screen: 'PreferredPlayers'})
            }>
            <Text style={styles.actionEmoji}>📊</Text>
            <Text style={styles.actionLabel}>Мой{'\n'}рейтинг</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() =>
              navigation.navigate('ProfileTab', {screen: 'PreferredPlayers'})
            }>
            <Text style={styles.actionEmoji}>👥</Text>
            <Text style={styles.actionLabel}>Игроки</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Последние уведомления */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Последние уведомления</Text>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={async () => {
                await feedApi.markAllRead();
                setItems(prev => prev.map(n => ({...n, is_read: true})));
                setUnreadCount(0);
              }}>
              <Text style={styles.markAllText}>Прочитать все</Text>
            </TouchableOpacity>
          )}
        </View>

        {recentItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Нет новых уведомлений</Text>
          </View>
        ) : (
          recentItems.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
              activeOpacity={0.8}
              onPress={() => handleNotificationPress(item)}>
              <Text style={styles.notifIcon}>{TYPE_ICONS[item.type] ?? '📩'}</Text>
              <View style={styles.notifContent}>
                <Text style={styles.notifTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.body ? (
                  <Text style={styles.notifBody} numberOfLines={1}>
                    {item.body}
                  </Text>
                ) : null}
                <Text style={styles.notifTime}>{formatDateTime(item.created_at)}</Text>
              </View>
              {!item.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F5',
  },
  contentContainer: {
    paddingBottom: 32,
  },

  /* Шапка */
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerGreetRow: {
    flex: 1,
  },
  headerGreet: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: '#212121',
  },
  headerDate: {
    fontSize: FONT_SIZE.sm,
    color: '#757575',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginLeft: 12,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Карточка активного поиска */
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchCardIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  searchCardContent: {
    flex: 1,
  },
  searchCardTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: '#212121',
  },
  searchCardSub: {
    fontSize: FONT_SIZE.sm,
    color: '#757575',
    marginTop: 2,
  },
  searchCardCourt: {
    fontSize: FONT_SIZE.xs,
    color: '#43A047',
    fontWeight: '600',
    marginTop: 2,
  },
  searchCardTime: {
    fontSize: FONT_SIZE.xs,
    color: '#BDBDBD',
    marginTop: 2,
  },
  searchCardChevron: {
    fontSize: 26,
    color: '#BDBDBD',
    marginLeft: 8,
  },

  /* Секции */
  section: {
    marginTop: 20,
    marginHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
  },
  markAllText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },

  /* Сетка быстрых действий 2×2 */
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  actionEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: '#212121',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 17,
  },

  /* Карточки уведомлений */
  notifCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  notifCardUnread: {
    backgroundColor: '#E8F5E9',
  },
  notifIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#212121',
    lineHeight: 18,
  },
  notifBody: {
    fontSize: FONT_SIZE.xs,
    color: '#757575',
    marginTop: 2,
  },
  notifTime: {
    fontSize: FONT_SIZE.xs,
    color: '#BDBDBD',
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginLeft: 10,
  },

  /* Пустое состояние уведомлений */
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: '#757575',
    textAlign: 'center',
  },
});
