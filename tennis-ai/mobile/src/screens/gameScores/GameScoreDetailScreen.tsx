import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {gameScoresApi} from '../../api/gameScores';
import {GameScore} from '../../types/gameScore';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage, formatDateTime, formatInitials} from '../../utils/format';

export default function GameScoreDetailScreen({route, navigation}: any) {
  const id = route.params?.id as string;
  const me = useAuthStore(s => s.user);
  const [gs, setGs] = useState<GameScore | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const {data} = await gameScoresApi.get(id);
      setGs(data);
    } catch {}
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!gs || !me) {
    return <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />;
  }

  const iAmCreator = gs.creator_id === me.id;
  const iAmOpponent = gs.opponent_id === me.id;
  const opp = iAmCreator ? gs.opponent : gs.creator;
  const myPts = iAmCreator ? gs.creator_points : gs.opponent_points;
  const oppPts = iAmCreator ? gs.opponent_points : gs.creator_points;
  const serverIsMe = gs.server_id === me.id;

  const confirm = async () => {
    setBusy(true);
    try {
      const {data} = await gameScoresApi.confirm(id);
      setGs(data);
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось'));
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      const {data} = await gameScoresApi.decline(id, reason || undefined);
      setGs(data);
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось'));
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
            await gameScoresApi.delete(id);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось'));
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.label}>Соперник</Text>
        <Text style={styles.opp}>{formatInitials(opp.first_name, opp.last_name)}</Text>
      </View>

      <View style={styles.scoreCard}>
        <Text style={styles.label}>Текущий счёт гейма</Text>
        <Text style={styles.bigScore}>
          {myPts} : {oppPts}
        </Text>
        <Text style={styles.serveBadge}>
          🎾 {serverIsMe ? 'Я подаю' : `Подаёт ${opp.first_name}`}
        </Text>
        <Text style={styles.sub}>{formatDateTime(gs.played_at)}</Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.label}>Статус</Text>
        <Text style={styles.status}>
          {gs.status === 'pending'
            ? 'Ожидает подтверждения соперника'
            : gs.status === 'confirmed'
            ? 'Подтверждён'
            : 'Отклонён'}
        </Text>
        {gs.status === 'declined' && gs.decline_reason && (
          <Text style={styles.sub}>Причина: {gs.decline_reason}</Text>
        )}
      </View>

      {gs.notes && (
        <View style={styles.notesCard}>
          <Text style={styles.label}>Примечание</Text>
          <Text style={styles.notes}>{gs.notes}</Text>
        </View>
      )}

      {gs.status === 'pending' && iAmOpponent && (
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
            value={reason}
            onChangeText={setReason}
          />
          <TouchableOpacity
            style={[styles.btn, styles.declineBtn, busy && styles.disabled]}
            onPress={decline}
            disabled={busy}>
            <Text style={styles.btnText}>Отклонить</Text>
          </TouchableOpacity>
        </View>
      )}

      {gs.status !== 'confirmed' && iAmCreator && (
        <View style={styles.actions}>
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
  center: {flex: 1},
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
  bigScore: {fontSize: 56, fontWeight: '800', color: COLORS.primary, marginVertical: SPACING.sm},
  serveBadge: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
  },
  status: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text},
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
