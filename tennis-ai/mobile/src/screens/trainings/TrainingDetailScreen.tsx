import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {trainingsApi} from '../../api/trainings';
import {Training} from '../../types/training';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage, formatDateTime} from '../../utils/format';

export default function TrainingDetailScreen({route, navigation}: any) {
  const id = route.params?.id as string;
  const me = useAuthStore(s => s.user);
  const [t, setT] = useState<Training | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const {data} = await trainingsApi.get(id);
      setT(data);
    } catch {}
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!t || !me) {
    return <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />;
  }

  const isOrganizer = t.organizer_id === me.id;
  const myParticipation = t.participants.find(p => p.user.id === me.id);

  const respond = async (status: 'confirmed' | 'declined' | 'cancelled') => {
    setBusy(true);
    try {
      const {data} = await trainingsApi.respond(id, status);
      setT(data);
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось'));
    } finally {
      setBusy(false);
    }
  };

  const cancelTraining = async () => {
    Alert.alert('Отменить тренировку?', '', [
      {text: 'Нет', style: 'cancel'},
      {
        text: 'Отменить',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const {data} = await trainingsApi.cancel(id);
            setT(data);
          } catch (e: any) {
            Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const statusLabels: Record<string, string> = {
    invited: 'Приглашён',
    confirmed: 'Подтвердил',
    declined: 'Отклонил',
    cancelled: 'Отменил',
  };

  const statusColors: Record<string, string> = {
    invited: COLORS.warning,
    confirmed: COLORS.success,
    declined: COLORS.error,
    cancelled: COLORS.disabled,
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t.title}</Text>
          <View
            style={[
              styles.badge,
              {backgroundColor: t.schedule_type === 'weekly' ? '#7E57C2' : COLORS.primary},
            ]}>
            <Text style={styles.badgeText}>
              {t.schedule_type === 'weekly' ? `Еженед. × ${t.weeks_count}` : 'Разовая'}
            </Text>
          </View>
        </View>
        <Text style={styles.time}>📅 {formatDateTime(t.start_time)}</Text>
        <Text style={styles.time}>🕒 до {formatDateTime(t.end_time)}</Text>
        {t.location && <Text style={styles.location}>📍 {t.location}</Text>}
        {t.description && <Text style={styles.description}>{t.description}</Text>}
        <Text style={styles.organizer}>
          Организатор: {t.organizer.last_name} {t.organizer.first_name}
        </Text>
        {t.trainer && (
          <Text style={styles.organizer}>
            👨‍🏫 Тренер: {t.trainer.last_name} {t.trainer.first_name}
          </Text>
        )}
        {t.status === 'cancelled' && (
          <Text style={styles.cancelled}>Тренировка отменена</Text>
        )}
      </View>

      {!isOrganizer && myParticipation && t.status === 'active' && (
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Ваше участие</Text>
          <Text style={[styles.myStatus, {color: statusColors[myParticipation.status]}]}>
            {statusLabels[myParticipation.status]}
          </Text>
          {myParticipation.status === 'invited' && (
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, styles.confirmBtn, busy && styles.disabled]}
                disabled={busy}
                onPress={() => respond('confirmed')}>
                <Text style={styles.btnText}>Принять</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.declineBtn, busy && styles.disabled]}
                disabled={busy}
                onPress={() => respond('declined')}>
                <Text style={styles.btnText}>Отклонить</Text>
              </TouchableOpacity>
            </View>
          )}
          {myParticipation.status === 'confirmed' && (
            <TouchableOpacity
              style={[styles.btn, styles.declineBtn, busy && styles.disabled]}
              disabled={busy}
              onPress={() => respond('cancelled')}>
              <Text style={styles.btnText}>Не смогу прийти</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={styles.section}>Участники ({t.participants.length})</Text>
      {t.participants.map(p => (
        <View key={p.id} style={styles.partCard}>
          <View style={{flex: 1}}>
            <Text style={styles.partName}>
              {p.user.last_name} {p.user.first_name}
            </Text>
            <Text style={styles.partMeta}>СТМ {p.user.stm_level} • Elo {p.user.elo_rating}</Text>
          </View>
          <Text style={[styles.partStatus, {color: statusColors[p.status]}]}>
            {statusLabels[p.status]}
          </Text>
        </View>
      ))}

      {isOrganizer && t.status === 'active' && (
        <TouchableOpacity
          style={[styles.btn, styles.cancelBtn, busy && styles.disabled, {marginTop: SPACING.md}]}
          disabled={busy}
          onPress={cancelTraining}>
          <Text style={styles.btnText}>Отменить тренировку</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md},
  center: {flex: 1},

  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  title: {fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, flex: 1},
  badge: {paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: 8, marginLeft: SPACING.xs},
  badgeText: {color: COLORS.textLight, fontSize: FONT_SIZE.xs, fontWeight: '700'},
  time: {fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600', marginTop: 4},
  location: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4},
  description: {fontSize: FONT_SIZE.sm, color: COLORS.text, marginTop: SPACING.sm, lineHeight: 20},
  organizer: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: SPACING.sm},
  cancelled: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.error,
    marginTop: SPACING.sm,
  },

  actionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  actionTitle: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary},
  myStatus: {fontSize: FONT_SIZE.lg, fontWeight: '700', marginTop: 4, marginBottom: SPACING.sm},
  btnRow: {flexDirection: 'row', gap: SPACING.sm},

  section: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  partCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
  },
  partName: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text},
  partMeta: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2},
  partStatus: {fontSize: FONT_SIZE.sm, fontWeight: '700'},

  btn: {flex: 1, padding: SPACING.md, borderRadius: 12, alignItems: 'center'},
  confirmBtn: {backgroundColor: COLORS.success},
  declineBtn: {backgroundColor: COLORS.error},
  cancelBtn: {backgroundColor: COLORS.error, flex: undefined},
  btnText: {color: COLORS.textLight, fontWeight: '700', fontSize: FONT_SIZE.md},
  disabled: {opacity: 0.6},
});
