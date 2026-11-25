import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Switch,
  Alert,
} from 'react-native';
import {locationsApi} from '../../api/locations';
import {Location, PreferredLocation} from '../../types/location';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage} from '../../utils/format';

export default function PreferredLocationsScreen() {
  const [preferred, setPreferred] = useState<PreferredLocation[]>([]);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const user = useAuthStore(s => s.user);

  const load = useCallback(async () => {
    try {
      const {data} = await locationsApi.getPreferred();
      setPreferred(data);
    } catch {}
  }, []);

  const loadAll = async () => {
    try {
      const {data} = await locationsApi.list();
      setAllLocations(data);
      setShowAll(true);
    } catch {}
  };

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleSearch = async (id: string, current: boolean) => {
    try {
      await locationsApi.updatePreferred(id, !current);
      setPreferred(prev => prev.map(p => p.id === id ? {...p, use_in_search: !current} : p));
    } catch {}
  };

  const addLocation = async (locationId: string) => {
    try {
      await locationsApi.addPreferred(locationId);
      setShowAll(false);
      load();
      Alert.alert('Добавлено');
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Уже добавлена'));
    }
  };

  const removeLocation = async (id: string) => {
    try {
      await locationsApi.removePreferred(id);
      setPreferred(prev => prev.filter(p => p.id !== id));
    } catch {}
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={preferred}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.title}>Предпочитаемые локации</Text>
        }
        renderItem={({item}) => (
          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.locName}>{item.location.name}</Text>
              <Text style={styles.locAddress}>{item.location.address}</Text>
            </View>
            <View style={styles.cardActions}>
              <Switch
                value={item.use_in_search}
                onValueChange={() => toggleSearch(item.id, item.use_in_search)}
                trackColor={{true: COLORS.primaryLight}}
              />
              <TouchableOpacity onPress={() => removeLocation(item.id)}>
                <Text style={styles.removeText}>Удалить</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Нет предпочитаемых локаций</Text>
        }
        ListFooterComponent={
          <>
            {!showAll ? (
              <TouchableOpacity style={styles.addBtn} onPress={loadAll}>
                <Text style={styles.addBtnText}>Добавить локацию</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={styles.sectionTitle}>Все локации</Text>
                {allLocations.map(loc => {
                  const already = preferred.some(p => p.location_id === loc.id);
                  return (
                    <TouchableOpacity
                      key={loc.id}
                      style={[styles.allCard, already && styles.allCardAdded]}
                      onPress={() => !already && addLocation(loc.id)}
                      disabled={already}>
                      <Text style={styles.locName}>{loc.name}</Text>
                      <Text style={styles.locAddress}>{loc.address}</Text>
                      {already && <Text style={styles.addedText}>Добавлена</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  list: {padding: SPACING.sm},
  title: {fontSize: FONT_SIZE.lg, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.sm, paddingHorizontal: SPACING.xs},
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  cardInfo: {flex: 1, marginRight: SPACING.sm},
  locName: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text},
  locAddress: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2},
  cardActions: {alignItems: 'center', gap: SPACING.xs},
  removeText: {fontSize: FONT_SIZE.xs, color: COLORS.error},
  empty: {textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.md},
  addBtn: {
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: 12, borderStyle: 'dashed',
    padding: SPACING.md, alignItems: 'center', marginTop: SPACING.sm,
  },
  addBtnText: {color: COLORS.primary, fontWeight: '600'},
  sectionTitle: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.sm},
  allCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  allCardAdded: {opacity: 0.5},
  addedText: {fontSize: FONT_SIZE.xs, color: COLORS.success, marginTop: 4},
});
