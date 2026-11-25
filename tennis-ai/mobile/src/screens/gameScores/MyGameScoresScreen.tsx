import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {gameScoresApi} from '../../api/gameScores';
import {GameScore} from '../../types/gameScore';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {formatDateTime} from '../../utils/format';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Ожидает',
  confirmed: 'Подтверждён',
  declined: 'Отклонён',
};

const STATUS_COLOR: Record<string, string> = {
  pending: COLORS.warning,
  confirmed: COLORS.success,
  declined: COLORS.error,
};

export default function MyGameScoresScreen({navigation}: any) {
  const me = useAuthStore(s => s.user);
  const [items, setItems] = useState<GameScore[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const {data} = await gameScoresApi.list();
      setItems(data);
    } catch {}
  }, []);

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

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={items.length === 0 ? styles.emptyWrap : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Записей о геймах пока нет</Text>
        }
        renderItem={({item}) => {
          const iAmCreator = item.creator_id === me?.id;
          const opp = iAmCreator ? item.opponent : item.creator;
          const myPts = iAmCreator ? item.creator_points : item.opponent_points;
          const oppPts = iAmCreator ? item.opponent_points : item.creator_points;
          const isServerMe = item.server_id === me?.id;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('GameScoreDetail', {id: item.id})}>
              <View style={styles.row}>
                <Text style={styles.opp}>
                  {opp.last_name} {opp.first_name[0]}.
                </Text>
                <Text style={[styles.status, {color: STATUS_COLOR[item.status]}]}>
                  {STATUS_LABEL[item.status]}
                </Text>
              </View>
              <Text style={styles.score}>
                {myPts} : {oppPts}
              </Text>
              <Text style={styles.meta}>
                {isServerMe ? '🎾 Моя подача' : '🎾 Подача соперника'} •{' '}
                {formatDateTime(item.played_at)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateGameScore')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  list: {padding: SPACING.sm},
  emptyWrap: {flex: 1, justifyContent: 'center'},
  empty: {textAlign: 'center', color: COLORS.textSecondary, fontSize: FONT_SIZE.md},
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  row: {flexDirection: 'row', justifyContent: 'space-between'},
  opp: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text},
  status: {fontSize: FONT_SIZE.sm, fontWeight: '700'},
  score: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center',
    marginVertical: SPACING.sm,
  },
  meta: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textAlign: 'center'},
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
});
