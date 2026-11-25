import React, {useCallback, useEffect, useLayoutEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {matchesApi} from '../../api/matches';
import {MatchSet} from '../../types/match';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {formatDate, formatInitials} from '../../utils/format';

type Tab = 'confirmed' | 'pending' | 'all';

// ─── helpers ────────────────────────────────────────────────────────────────

function isWinner(item: MatchSet, myId: string): boolean {
  const iAmCreator = item.creator_id === myId;
  const mySets = iAmCreator ? item.creator_games : item.opponent_games;
  const oppSets = iAmCreator ? item.opponent_games : item.creator_games;
  return mySets > oppSets;
}

function formatSets(item: MatchSet, myId: string): string {
  const iAmCreator = item.creator_id === myId;
  const myG = iAmCreator ? item.creator_games : item.opponent_games;
  const oppG = iAmCreator ? item.opponent_games : item.creator_games;
  const myTb = iAmCreator ? item.creator_tiebreak : item.opponent_tiebreak;
  const oppTb = iAmCreator ? item.opponent_tiebreak : item.creator_tiebreak;
  let result = `${myG}:${oppG}`;
  if (myTb !== null && oppTb !== null) {
    result += ` (${myTb}:${oppTb})`;
  }
  return result;
}

function getOpponent(item: MatchSet, myId: string) {
  return item.creator_id === myId ? item.opponent : item.creator;
}

// ─── sub-components ─────────────────────────────────────────────────────────

interface HistoryCardProps {
  item: MatchSet;
  myId: string;
  onPress: () => void;
}

function HistoryCard({item, myId, onPress}: HistoryCardProps) {
  const won = isWinner(item, myId);
  const opp = getOpponent(item, myId);
  const oppName = formatInitials(opp.first_name, opp.last_name);
  const setsStr = formatSets(item, myId);
  const borderColor = won ? COLORS.success : COLORS.error;

  return (
    <TouchableOpacity
      style={[styles.card, {borderLeftColor: borderColor}]}
      onPress={onPress}
      activeOpacity={0.75}>
      {/* top row: opponent + date */}
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <Text style={styles.emoji}>{won ? '🏆' : '😔'}</Text>
          <Text style={styles.oppName}>{oppName}</Text>
        </View>
        <Text style={styles.dateText}>{formatDate(item.played_at)}</Text>
      </View>
      {/* bottom row: score */}
      <View style={styles.cardRow}>
        <Text style={[styles.setsText, won ? styles.winText : styles.lossText]}>
          {setsStr}
        </Text>
        <Text style={[styles.outcomeLabel, won ? styles.winText : styles.lossText]}>
          {won ? 'Победа' : 'Поражение'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

interface PendingCardProps {
  item: MatchSet;
  myId: string;
  onPress: () => void;
  onConfirm: () => void;
  onDecline: () => void;
}

function PendingCard({item, myId, onPress, onConfirm, onDecline}: PendingCardProps) {
  const iAmCreator = item.creator_id === myId;
  const opp = getOpponent(item, myId);
  const oppName = formatInitials(opp.first_name, opp.last_name);
  // incoming = opponent sees the pending match → they need to confirm
  const isIncoming = !iAmCreator;

  return (
    <TouchableOpacity
      style={[styles.card, styles.pendingCard]}
      onPress={onPress}
      activeOpacity={0.75}>
      <View style={styles.cardRow}>
        <Text style={styles.pendingIcon}>⏳</Text>
        <Text style={styles.pendingLabel}>
          {isIncoming
            ? `Ожидает вашего подтверждения`
            : `Ожидает подтверждения от ${oppName}`}
        </Text>
      </View>
      <Text style={styles.oppName}>{oppName}</Text>
      <Text style={styles.dateText}>{formatDate(item.played_at)}</Text>
      {isIncoming && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.btnConfirm}
            onPress={e => {
              e.stopPropagation?.();
              onConfirm();
            }}>
            <Text style={styles.btnConfirmText}>Подтвердить</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnDecline}
            onPress={e => {
              e.stopPropagation?.();
              onDecline();
            }}>
            <Text style={styles.btnDeclineText}>Отклонить</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── empty state ─────────────────────────────────────────────────────────────

function EmptyState({tab}: {tab: Tab}) {
  const msg =
    tab === 'confirmed'
      ? 'Нет сыгранных матчей'
      : tab === 'pending'
      ? 'Нет ожидающих матчей'
      : 'Нет матчей';
  const sub =
    tab === 'confirmed'
      ? 'Запишите свой первый матч!'
      : tab === 'pending'
      ? 'Все матчи подтверждены'
      : 'Нажмите + чтобы добавить матч';

  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyIcon}>🎾</Text>
      <Text style={styles.emptyTitle}>{msg}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function MyMatchesScreen({navigation}: any) {
  const me = useAuthStore(s => s.user);

  const [tab, setTab] = useState<Tab>('confirmed');
  const [confirmed, setConfirmed] = useState<MatchSet[]>([]);
  const [pending, setPending] = useState<MatchSet[]>([]);
  const [all, setAll] = useState<MatchSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // header "+" button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('CreateMatch')}>
          <Text style={styles.headerBtnText}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const load = useCallback(async () => {
    try {
      const [confRes, pendRes, allRes] = await Promise.all([
        matchesApi.list({status: 'confirmed'}),
        matchesApi.list({status: 'pending'}),
        matchesApi.list(),
      ]);
      setConfirmed(confRes.data);
      setPending(pendRes.data);
      setAll(allRes.data);
    } catch {
      // silent — network errors shown by interceptor
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleConfirm = async (item: MatchSet) => {
    try {
      await matchesApi.confirm(item.id);
      await load();
    } catch {
      Alert.alert('Ошибка', 'Не удалось подтвердить матч');
    }
  };

  const handleDecline = (item: MatchSet) => {
    Alert.alert('Отклонить матч?', 'Матч будет помечен как отклонённый', [
      {text: 'Отмена', style: 'cancel'},
      {
        text: 'Отклонить',
        style: 'destructive',
        onPress: async () => {
          try {
            await matchesApi.decline(item.id);
            await load();
          } catch {
            Alert.alert('Ошибка', 'Не удалось отклонить матч');
          }
        },
      },
    ]);
  };

  const data = tab === 'confirmed' ? confirmed : tab === 'pending' ? pending : all;
  const pendingCount = pending.length;

  const renderItem = ({item}: {item: MatchSet}) => {
    const myId = me?.id ?? '';
    const toDetail = () => navigation.navigate('MatchDetail', {id: item.id});

    if (item.status === 'pending') {
      return (
        <PendingCard
          item={item}
          myId={myId}
          onPress={toDetail}
          onConfirm={() => handleConfirm(item)}
          onDecline={() => handleDecline(item)}
        />
      );
    }
    return <HistoryCard item={item} myId={myId} onPress={toDetail} />;
  };

  return (
    <View style={styles.container}>
      {/* ── tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsBar}
        contentContainerStyle={styles.tabsContent}>
        {(['confirmed', 'pending', 'all'] as Tab[]).map(t => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => setTab(t)}>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {t === 'confirmed'
                  ? 'История'
                  : t === 'pending'
                  ? pendingCount > 0
                    ? `Ожидают`
                    : 'Ожидают'
                  : 'Все'}
              </Text>
              {t === 'pending' && pendingCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── list ── */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={i => i.id}
          contentContainerStyle={[
            styles.list,
            data.length === 0 && styles.listEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={<EmptyState tab={tab} />}
        />
      )}
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F5',
  },

  // header button
  headerBtn: {
    marginRight: SPACING.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '400',
  },

  // tabs bar
  tabsBar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexGrow: 0,
  },
  tabsContent: {
    paddingHorizontal: SPACING.sm,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabItemActive: {
    borderBottomColor: COLORS.primary,
  },
  tabLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: COLORS.warning,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    lineHeight: 18,
  },

  // list
  list: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  listEmpty: {
    flexGrow: 1,
  },
  loader: {
    flex: 1,
    alignSelf: 'center',
    marginTop: SPACING.xl,
  },

  // base card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
    // elevation
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },

  // history card internals
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emoji: {
    fontSize: 18,
  },
  oppName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  dateText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  setsText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  outcomeLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  winText: {
    color: COLORS.success,
  },
  lossText: {
    color: COLORS.error,
  },

  // pending card
  pendingCard: {
    borderLeftColor: COLORS.warning,
  },
  pendingIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  pendingLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  btnConfirm: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  btnConfirmText: {
    color: '#fff',
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  btnDecline: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  btnDeclineText: {
    color: COLORS.error,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },

  // empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.xl * 2,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  emptySub: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
