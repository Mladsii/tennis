import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import {competitionsApi} from '../../api/competitions';
import {Competition, CompetitionGroup} from '../../types/competition';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage, formatDate} from '../../utils/format';

export default function CompetitionDetailScreen({route}: any) {
  const {id} = route.params;
  const me = useAuthStore(s => s.user);

  const [comp, setComp] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const {data} = await competitionsApi.get(id);
      setComp(data);
    } catch {} finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />;
  }
  if (!comp) {
    return <Text style={styles.empty}>Не найдено</Text>;
  }

  const isOrganizer = comp.organizer.id === me?.id;

  const inviteByFilter = (g: CompetitionGroup) => {
    Alert.alert(
      'Разослать приглашения?',
      `Уведомление получат игроки, подходящие под фильтр группы «${g.name}» (возраст и СТМ)`,
      [
        {text: 'Отмена', style: 'cancel'},
        {
          text: 'Разослать',
          onPress: async () => {
            setBusy(true);
            try {
              const {data} = await competitionsApi.inviteByFilter(comp.id, {group_id: g.id});
              Alert.alert(
                'Готово',
                `Подходящих игроков: ${data.matched}\nОтправлено: ${data.sent}`,
              );
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

  const isMyGroup = (g: CompetitionGroup) =>
    g.participants.some(p => p.user.id === me?.id && p.status === 'registered');

  const myActiveGroupId = comp.groups.find(isMyGroup)?.id;

  const handleRegister = async (g: CompetitionGroup) => {
    if (busy) return;
    if (myActiveGroupId && myActiveGroupId !== g.id) {
      Alert.alert(
        'Уже зарегистрированы',
        'Сначала отмените регистрацию в другой группе',
      );
      return;
    }
    Alert.alert(
      'Регистрация',
      `Записаться в группу «${g.name}»?`,
      [
        {text: 'Отмена', style: 'cancel'},
        {
          text: 'Записаться',
          onPress: async () => {
            setBusy(true);
            try {
              await competitionsApi.register(comp.id, g.id);
              await load();
            } catch (e: any) {
              Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось записаться'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleUnregister = async (g: CompetitionGroup) => {
    if (busy) return;
    Alert.alert(
      'Отменить?',
      `Отменить регистрацию в группе «${g.name}»?`,
      [
        {text: 'Нет', style: 'cancel'},
        {
          text: 'Отменить',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await competitionsApi.unregister(comp.id, g.id);
              await load();
            } catch (e: any) {
              Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось отменить'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.headerCard}>
        <Text style={styles.name}>{comp.name}</Text>
        <Text style={styles.dates}>
          {formatDate(comp.start_date)} — {formatDate(comp.end_date)}
        </Text>
        {comp.location && <Text style={styles.location}>📍 {comp.location}</Text>}
        {comp.description && <Text style={styles.description}>{comp.description}</Text>}
        <Text style={styles.organizer}>
          Организатор: {comp.organizer.last_name} {comp.organizer.first_name}
        </Text>
      </View>

      <Text style={styles.section}>Группы ({comp.groups.length})</Text>

      {comp.groups.length === 0 && (
        <Text style={styles.empty}>Группы ещё не добавлены</Text>
      )}

      {comp.groups.map(g => {
        const active = g.participants.filter(p => p.status === 'registered');
        const mine = active.some(p => p.user.id === me?.id);
        const full = g.max_participants !== null && active.length >= g.max_participants;
        return (
          <View key={g.id} style={[styles.groupCard, mine && styles.groupCardMine]}>
            <Text style={styles.groupName}>{g.name}</Text>
            <Text style={styles.groupMeta}>
              {g.age_from || g.age_to
                ? `Возраст: ${g.age_from ?? '—'}–${g.age_to ?? '—'}  `
                : ''}
              {g.stm_from || g.stm_to
                ? `СТМ: ${g.stm_from ?? '—'}–${g.stm_to ?? '—'}  `
                : ''}
            </Text>
            <Text style={styles.groupCount}>
              👥 {active.length}
              {g.max_participants ? ` / ${g.max_participants}` : ''}
            </Text>

            {active.length > 0 && (
              <View style={styles.participants}>
                {active.map(p => (
                  <Text key={p.id} style={styles.participant}>
                    • {p.user.last_name} {p.user.first_name[0]}.{' '}
                    <Text style={styles.elo}>(Elo {p.user.elo_rating})</Text>
                  </Text>
                ))}
              </View>
            )}

            {isOrganizer && (
              <TouchableOpacity
                style={[styles.btn, styles.btnInvite]}
                disabled={busy}
                onPress={() => inviteByFilter(g)}>
                <Text style={styles.btnInviteText}>📢 Разослать приглашения по фильтру</Text>
              </TouchableOpacity>
            )}

            {mine ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnUnregister]}
                disabled={busy}
                onPress={() => handleUnregister(g)}>
                <Text style={styles.btnUnregisterText}>Отменить регистрацию</Text>
              </TouchableOpacity>
            ) : full ? (
              <View style={[styles.btn, styles.btnFull]}>
                <Text style={styles.btnFullText}>Группа заполнена</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.btn, styles.btnRegister]}
                disabled={busy}
                onPress={() => handleRegister(g)}>
                <Text style={styles.btnRegisterText}>Записаться</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md},
  center: {flex: 1},
  empty: {textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.lg},

  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  name: {fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text},
  dates: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  location: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4},
  description: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  organizer: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: SPACING.sm},

  section: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.border,
  },
  groupCardMine: {borderLeftColor: COLORS.success},
  groupName: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text},
  groupMeta: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4},
  groupCount: {fontSize: FONT_SIZE.sm, color: COLORS.success, fontWeight: '600', marginTop: 4},

  participants: {marginTop: SPACING.sm},
  participant: {fontSize: FONT_SIZE.sm, color: COLORS.text, marginVertical: 2},
  elo: {color: COLORS.textSecondary, fontSize: FONT_SIZE.xs},

  btn: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnRegister: {backgroundColor: COLORS.primary},
  btnRegisterText: {color: COLORS.textLight, fontWeight: '600'},
  btnUnregister: {borderWidth: 1, borderColor: COLORS.error},
  btnUnregisterText: {color: COLORS.error, fontWeight: '600'},
  btnFull: {backgroundColor: COLORS.disabled},
  btnFullText: {color: COLORS.textLight, fontWeight: '600'},
  btnInvite: {backgroundColor: '#FF9800'},
  btnInviteText: {color: COLORS.textLight, fontWeight: '600'},
});
