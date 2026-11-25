import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import {matchesApi} from '../../api/matches';
import {MatchSet} from '../../types/match';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage, formatDateTime, formatInitials} from '../../utils/format';

export default function MatchDetailScreen({route, navigation}: any) {
  const id = route.params?.id as string;
  const me = useAuthStore(s => s.user);
  const [ms, setMs] = useState<MatchSet | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const {data} = await matchesApi.get(id);
      setMs(data);
    } catch {}
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!ms || !me) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Загрузка…</Text>
      </View>
    );
  }

  const iAmCreator = ms.creator_id === me.id;
  const iAmOpponent = ms.opponent_id === me.id;
  const opp = iAmCreator ? ms.opponent : ms.creator;
  const myGames = iAmCreator ? ms.creator_games : ms.opponent_games;
  const oppGames = iAmCreator ? ms.opponent_games : ms.creator_games;
  const myTb = iAmCreator ? ms.creator_tiebreak : ms.opponent_tiebreak;
  const oppTb = iAmCreator ? ms.opponent_tiebreak : ms.creator_tiebreak;
  const myEloChange = iAmCreator ? ms.creator_elo_change : ms.opponent_elo_change;
  const myEloBefore = iAmCreator ? ms.creator_elo_before : ms.opponent_elo_before;

  const confirm = async () => {
    setBusy(true);
    try {
      const {data} = await matchesApi.confirm(id);
      setMs(data);
      Alert.alert('Готово', 'Счёт подтверждён, рейтинг Elo пересчитан');
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось подтвердить'));
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      const {data} = await matchesApi.decline(id, declineReason || undefined);
      setMs(data);
      Alert.alert('Отклонено', 'Соперник получит уведомление');
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось отклонить'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    Alert.alert('Удалить?', 'Запись будет удалена', [
      {text: 'Отмена', style: 'cancel'},
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await matchesApi.delete(id);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось удалить'));
            setBusy(false);
          }
        },
      },
    ]);
  };

  const won = myGames > oppGames;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.label}>Соперник</Text>
        <Text style={styles.opp}>
          {formatInitials(opp.first_name, opp.last_name)}
        </Text>
        <Text style={styles.sub}>Elo соперника: {opp.elo_rating}</Text>
      </View>

      <View style={styles.scoreCard}>
        <Text style={styles.label}>Счёт сета</Text>
        <Text
          style={[
            styles.bigScore,
            ms.status === 'confirmed' && (won ? styles.win : styles.loss),
          ]}>
          {myGames} : {oppGames}
        </Text>
        {myTb !== null && oppTb !== null && (
          <Text style={styles.tb}>тай-брейк {myTb} : {oppTb}</Text>
        )}
        <Text style={styles.sub}>{formatDateTime(ms.played_at)}</Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.label}>Статус</Text>
        <Text style={styles.status}>
          {ms.status === 'pending'
            ? 'Ожидает подтверждения соперника'
            : ms.status === 'confirmed'
            ? 'Подтверждён'
            : 'Отклонён'}
        </Text>
        {ms.status === 'declined' && ms.decline_reason && (
          <Text style={styles.sub}>Причина: {ms.decline_reason}</Text>
        )}
        {ms.status === 'confirmed' && myEloChange !== null && myEloBefore !== null && (
          <Text style={[styles.elo, (myEloChange ?? 0) >= 0 ? styles.win : styles.loss]}>
            Ваш Elo: {myEloBefore} → {(myEloBefore ?? 0) + (myEloChange ?? 0)} ({(myEloChange ?? 0) >= 0 ? '+' : ''}
            {myEloChange})
          </Text>
        )}
      </View>

      {ms.notes && (
        <View style={styles.notesCard}>
          <Text style={styles.label}>Примечание</Text>
          <Text style={styles.notes}>{ms.notes}</Text>
        </View>
      )}

      {ms.status === 'pending' && iAmOpponent && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.confirmBtn, busy && styles.disabled]}
            onPress={confirm}
            disabled={busy}>
            <Text style={styles.btnText}>Подтвердить счёт</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Причина отклонения (необязательно)"
            placeholderTextColor={COLORS.textSecondary}
            value={declineReason}
            onChangeText={setDeclineReason}
          />
          <TouchableOpacity
            style={[styles.btn, styles.declineBtn, busy && styles.disabled]}
            onPress={decline}
            disabled={busy}>
            <Text style={styles.btnText}>Отклонить</Text>
          </TouchableOpacity>
        </View>
      )}

      {ms.status === 'pending' && iAmCreator && (
        <View style={styles.actions}>
          <Text style={styles.sub}>
            Соперник {formatInitials(opp.first_name, opp.last_name)} ещё не подтвердил счёт.
          </Text>
          <TouchableOpacity
            style={[styles.btn, styles.dangerBtn, busy && styles.disabled]}
            onPress={remove}
            disabled={busy}>
            <Text style={styles.btnText}>Удалить запись</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  loading: {color: COLORS.textSecondary},
  header: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  scoreCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  notesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  label: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: 4},
  opp: {fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text},
  sub: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4},
  bigScore: {fontSize: 48, fontWeight: '800', color: COLORS.text, marginVertical: SPACING.sm},
  tb: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary},
  status: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text},
  elo: {fontSize: FONT_SIZE.md, fontWeight: '700', marginTop: SPACING.sm},
  win: {color: COLORS.success},
  loss: {color: COLORS.error},
  notes: {fontSize: FONT_SIZE.sm, color: COLORS.text},
  actions: {marginTop: SPACING.md, gap: SPACING.sm},
  btn: {padding: SPACING.md, borderRadius: 12, alignItems: 'center'},
  confirmBtn: {backgroundColor: COLORS.success},
  declineBtn: {backgroundColor: COLORS.error},
  dangerBtn: {backgroundColor: COLORS.error},
  btnText: {color: COLORS.textLight, fontSize: FONT_SIZE.md, fontWeight: '600'},
  disabled: {opacity: 0.6},
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
});
