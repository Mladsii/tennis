import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {matchesApi} from '../../api/matches';
import {PlayerRanking} from '../../types/match';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {formatInitials} from '../../utils/format';

export default function RankingsScreen({navigation}: any) {
  const me = useAuthStore(s => s.user);
  const [items, setItems] = useState<PlayerRanking[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const {data} = await matchesApi.preferredRanking();
      setItems(data);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({item, index}: {item: PlayerRanking; index: number}) => {
    const isMe = me?.id === item.user.id;
    return (
      <TouchableOpacity
        style={[styles.row, isMe && styles.meRow]}
        onPress={() => !isMe && navigation.navigate('PlayerProfile', {userId: item.user.id})}
        activeOpacity={isMe ? 1 : 0.7}>
        <Text style={styles.rank}>{index + 1}</Text>
        <View style={styles.info}>
          <Text style={[styles.name, isMe && styles.meText]}>
            {isMe ? 'Вы' : formatInitials(item.user.first_name, item.user.last_name)}
          </Text>
          <Text style={styles.sub}>
            {item.wins} / {item.losses}  ·  СТМ {item.user.stm_level}
          </Text>
        </View>
        <Text style={[styles.elo, isMe && styles.meText]}>{item.elo_rating}</Text>
        {!isMe && <Text style={styles.arrow}>›</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerCol}>#</Text>
        <Text style={[styles.headerCol, styles.headerCenter]}>Игрок</Text>
        <Text style={styles.headerCol}>Elo</Text>
      </View>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={i => i.user.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Добавьте друзей и сыграйте матчи, чтобы увидеть рейтинг.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  header: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerCol: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '600'},
  headerCenter: {flex: 1, marginLeft: SPACING.md},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  meRow: {backgroundColor: '#E8F5E9'},
  rank: {fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, width: 32},
  info: {flex: 1, marginLeft: SPACING.sm},
  name: {fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: '500'},
  meText: {color: COLORS.primary, fontWeight: '700'},
  sub: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2},
  elo: {fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text},
  arrow: {fontSize: 20, color: COLORS.disabled, marginLeft: SPACING.xs},
  empty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    padding: SPACING.lg,
    fontSize: FONT_SIZE.sm,
  },
});
