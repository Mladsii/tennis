import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {courtTransferApi} from '../../api/feed';
import {CourtTransfer} from '../../types/feed';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {formatDate, formatDateTime, formatTime} from '../../utils/format';

type Tab = 'available' | 'mine';

export default function MyCourtTransfersScreen({navigation}: any) {
  const [tab, setTab] = useState<Tab>('available');
  const [mine, setMine] = useState<CourtTransfer[]>([]);
  const [available, setAvailable] = useState<CourtTransfer[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mineRes, availRes] = await Promise.all([
        courtTransferApi.getMine(),
        courtTransferApi.getAvailable(),
      ]);
      setMine(mineRes.data);
      setAvailable(availRes.data);
    } catch {}
  }, []);

  useEffect(() => {
    load();
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

  const items = tab === 'mine' ? mine : available;

  const renderItem = ({item}: {item: CourtTransfer}) => (
    <TouchableOpacity
      style={[styles.card, !item.is_active && styles.inactive]}
      onPress={() => navigation.navigate('CourtTransferDetail', {id: item.id})}>
      <View style={styles.cardHeader}>
        <Text style={styles.time}>
          {formatDate(item.start_time)}, {formatTime(item.start_time)} — {formatTime(item.end_time)}
        </Text>
        <Text style={item.is_paid ? styles.paid : styles.free}>
          {item.is_paid ? 'Платно' : 'Бесплатно'}
        </Text>
      </View>
      {tab === 'available' && item.author && (
        <Text style={styles.author}>
          {item.author.last_name} {item.author.first_name}
        </Text>
      )}
      {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
      <Text style={styles.date}>{formatDateTime(item.created_at)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.gridBtn}
        onPress={() => navigation.navigate('LocationList')}>
        <Text style={styles.gridBtnText}>🏟️  Шахматка кортов</Text>
      </TouchableOpacity>
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
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {tab === 'mine' ? 'Нет моих передач' : 'Нет доступных кортов'}
          </Text>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateCourtTransfer')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  gridBtn: {
    backgroundColor: COLORS.secondary,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    borderRadius: 12,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  gridBtnText: {color: COLORS.textLight, fontWeight: '700', fontSize: FONT_SIZE.md},
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
  list: {padding: SPACING.sm},
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  inactive: {opacity: 0.5},
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  time: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text},
  paid: {fontSize: FONT_SIZE.sm, color: COLORS.secondary, fontWeight: '600'},
  free: {fontSize: FONT_SIZE.sm, color: COLORS.success, fontWeight: '600'},
  author: {fontSize: FONT_SIZE.sm, color: COLORS.text, marginBottom: 4},
  notes: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4},
  date: {fontSize: FONT_SIZE.xs, color: COLORS.disabled, marginTop: 4},
  empty: {textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xl},
  fab: {
    position: 'absolute', bottom: SPACING.lg, right: SPACING.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', elevation: 4,
    shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabText: {fontSize: 28, color: COLORS.textLight, marginTop: -2},
});
