import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {competitionsApi} from '../../api/competitions';
import {CompetitionListItem} from '../../types/competition';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {formatDate} from '../../utils/format';

export default function CompetitionsListScreen({navigation}: any) {
  const [items, setItems] = useState<CompetitionListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const {data} = await competitionsApi.list();
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
        ListEmptyComponent={<Text style={styles.empty}>Соревнований пока нет</Text>}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('CompetitionDetail', {id: item.id})}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.dates}>
              {formatDate(item.start_date)} — {formatDate(item.end_date)}
            </Text>
            {item.location && <Text style={styles.location}>📍 {item.location}</Text>}
            <View style={styles.row}>
              <Text style={styles.organizer}>
                {item.organizer.last_name} {item.organizer.first_name[0]}.
              </Text>
              <Text style={styles.count}>👥 {item.participant_count}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateCompetition')}>
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
  name: {fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text},
  dates: {fontSize: FONT_SIZE.sm, color: COLORS.primary, marginTop: 4, fontWeight: '600'},
  location: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  organizer: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary},
  count: {fontSize: FONT_SIZE.sm, color: COLORS.success, fontWeight: '600'},
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
