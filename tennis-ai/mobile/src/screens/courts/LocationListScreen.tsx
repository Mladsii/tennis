import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {bookingsApi} from '../../api/bookings';
import {LocationItem} from '../../types/booking';
import {COLORS, FONT_SIZE, SPACING, SHADOWS, RADIUS} from '../../constants/theme';

export default function LocationListScreen({navigation}: any) {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const {data} = await bookingsApi.getLocations();
      setLocations(data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Шапка */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Выберите площадку</Text>
        <Text style={styles.headerSubtitle}>Доступные локации</Text>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={locations}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏟️</Text>
            <Text style={styles.emptyText}>Нет доступных локаций</Text>
          </View>
        }
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.75}
            onPress={() =>
              navigation.navigate('CourtGrid', {
                locationId: item.id,
                locationName: item.name,
              })
            }>
            {/* Иконка */}
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>🏟️</Text>
            </View>

            {/* Текстовый блок */}
            <View style={styles.cardBody}>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.cardAddress} numberOfLines={1}>
                {item.city}, {item.address}
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.court_count} кортов</Text>
              </View>
            </View>

            {/* Стрелка */}
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

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
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  /* Список */
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: SPACING.lg,
  },

  /* Пустой экран */
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  /* Карточка */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: 12,
    padding: SPACING.md,
    ...SHADOWS.sm,
    elevation: 3,
  },

  /* Иконка */
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryGhost,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    flexShrink: 0,
  },
  iconText: {
    fontSize: 22,
  },

  /* Тело карточки */
  cardBody: {
    flex: 1,
  },
  cardName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardAddress: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  /* Badge */
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryGhost,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginTop: SPACING.xs,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },

  /* Стрелка */
  arrow: {
    fontSize: 24,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
    lineHeight: 28,
  },
});
