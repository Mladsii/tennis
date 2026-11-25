import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import {trainerRoleApi, TrainerApplication} from '../../api/trainerRole';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage} from '../../utils/format';

export default function AdminTrainerApplicationsScreen() {
  const [items, setItems] = useState<TrainerApplication[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const {data} = await trainerRoleApi.list();
      setItems(data);
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Только для администраторов'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const decide = (id: string, action: 'approve' | 'reject') => {
    Alert.alert(
      action === 'approve' ? 'Подтвердить?' : 'Отклонить?',
      '',
      [
        {text: 'Отмена', style: 'cancel'},
        {
          text: action === 'approve' ? 'Подтвердить' : 'Отклонить',
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            setBusy(true);
            try {
              if (action === 'approve') await trainerRoleApi.approve(id);
              else await trainerRoleApi.reject(id);
              await load();
            } catch (e: any) {
              Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={i => i.user_id}
      contentContainerStyle={items.length === 0 ? styles.emptyWrap : styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <Text style={styles.empty}>Нет заявок на рассмотрении</Text>
      }
      renderItem={({item}) => (
        <View style={styles.card}>
          <Text style={styles.name}>
            {item.last_name} {item.first_name} <Text style={styles.nick}>@{item.nickname}</Text>
          </Text>
          {item.trainer_skills && (
            <>
              <Text style={styles.label}>Навыки</Text>
              <Text style={styles.value}>{item.trainer_skills}</Text>
            </>
          )}
          {item.trainer_education && (
            <>
              <Text style={styles.label}>Образование</Text>
              <Text style={styles.value}>{item.trainer_education}</Text>
            </>
          )}
          {item.trainer_achievements && (
            <>
              <Text style={styles.label}>Достижения</Text>
              <Text style={styles.value}>{item.trainer_achievements}</Text>
            </>
          )}
          <Text style={styles.tags}>
            {item.trainer_individual && '· Инд '}
            {item.trainer_group && '· Групп '}
            {item.trainer_kids && '· Дети '}
            {item.trainer_disabled && '· Инвалиды '}
          </Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, styles.btnApprove, busy && styles.disabled]}
              disabled={busy}
              onPress={() => decide(item.user_id, 'approve')}>
              <Text style={styles.btnText}>Подтвердить</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnReject, busy && styles.disabled]}
              disabled={busy}
              onPress={() => decide(item.user_id, 'reject')}>
              <Text style={styles.btnText}>Отклонить</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
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
  nick: {color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '400'},
  label: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: SPACING.sm},
  value: {fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20},
  tags: {fontSize: FONT_SIZE.xs, color: COLORS.primary, marginTop: SPACING.sm, fontWeight: '600'},
  row: {flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md},
  btn: {flex: 1, padding: SPACING.sm, borderRadius: 8, alignItems: 'center'},
  btnApprove: {backgroundColor: COLORS.success},
  btnReject: {backgroundColor: COLORS.error},
  btnText: {color: COLORS.textLight, fontWeight: '700'},
  disabled: {opacity: 0.6},
});
