import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {matchesApi} from '../../api/matches';
import {preferredPlayersApi} from '../../api/feed';
import {PreferredPlayer} from '../../types/feed';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage} from '../../utils/format';

export default function CreateMatchScreen({route, navigation}: any) {
  // Pre-filled params when coming from SearchRequestDetail
  const prefillOpponentId: string | undefined = route.params?.opponentId;
  const prefillOpponentName: string | undefined = route.params?.opponentName;
  const prefillPlayedAt: string | undefined = route.params?.playedAt;

  const [opponents, setOpponents] = useState<PreferredPlayer[]>([]);
  const [opponentId, setOpponentId] = useState(prefillOpponentId ?? '');
  const [opponentName, setOpponentName] = useState(prefillOpponentName ?? '');
  const [date, setDate] = useState(() => {
    if (prefillPlayedAt) return prefillPlayedAt.slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  });
  const [time, setTime] = useState(() => {
    if (prefillPlayedAt) return prefillPlayedAt.slice(11, 16);
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [myGames, setMyGames] = useState('');
  const [oppGames, setOppGames] = useState('');
  const [myTb, setMyTb] = useState('');
  const [oppTb, setOppTb] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    preferredPlayersApi
      .list()
      .then(({data}) => setOpponents(data.filter(p => p.is_active)))
      .catch(() => {});
  }, []);

  const need76 =
    (parseInt(myGames, 10) === 7 && parseInt(oppGames, 10) === 6) ||
    (parseInt(myGames, 10) === 6 && parseInt(oppGames, 10) === 7);

  const submit = async () => {
    if (!opponentId) {
      Alert.alert('Ошибка', 'Выберите соперника');
      return;
    }
    const a = parseInt(myGames, 10);
    const b = parseInt(oppGames, 10);
    if (Number.isNaN(a) || Number.isNaN(b)) {
      Alert.alert('Ошибка', 'Введите счёт сета');
      return;
    }
    setLoading(true);
    try {
      const playedAt = new Date(`${date}T${time}:00`).toISOString();
      await matchesApi.create({
        opponent_id: opponentId,
        played_at: playedAt,
        creator_games: a,
        opponent_games: b,
        creator_tiebreak: need76 && myTb ? parseInt(myTb, 10) : null,
        opponent_tiebreak: need76 && oppTb ? parseInt(oppTb, 10) : null,
        notes: notes || null,
      });
      Alert.alert('Готово', 'Счёт сета отправлен сопернику на подтверждение');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось сохранить'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Записать счёт игры</Text>

      <Text style={styles.label}>Соперник</Text>
      {prefillOpponentId ? (
        <View style={styles.prefillBox}>
          <Text style={styles.prefillName}>{opponentName}</Text>
          <Text style={styles.prefillHint}>из подтверждённого поиска</Text>
        </View>
      ) : opponents.length === 0 ? (
        <Text style={styles.hint}>
          Сначала добавьте друзей.
        </Text>
      ) : (
        <View style={styles.chipsRow}>
          {opponents.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, opponentId === p.player.id && styles.chipActive]}
              onPress={() => {
                setOpponentId(p.player.id);
                setOpponentName(`${p.player.last_name} ${p.player.first_name}`);
              }}>
              <Text
                style={[
                  styles.chipText,
                  opponentId === p.player.id && styles.chipTextActive,
                ]}>
                {p.player.last_name} {p.player.first_name[0]}.
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.dateRow}>
        <View style={styles.dateInput}>
          <Text style={styles.label}>Дата (ГГГГ-ММ-ДД)</Text>
          <TextInput
            style={styles.input}
            placeholderTextColor={COLORS.textSecondary}
            placeholder="2026-04-24"
            value={date}
            onChangeText={setDate}
          />
        </View>
        <View style={styles.dateInput}>
          <Text style={styles.label}>Время (ЧЧ:ММ)</Text>
          <TextInput
            style={styles.input}
            placeholderTextColor={COLORS.textSecondary}
            placeholder="19:30"
            value={time}
            onChangeText={setTime}
          />
        </View>
      </View>

      <Text style={styles.label}>Счёт сета (мои геймы : сопернику)</Text>
      <View style={styles.scoreRow}>
        <TextInput
          style={styles.scoreInput}
          placeholderTextColor={COLORS.textSecondary}
          placeholder="6"
          value={myGames}
          onChangeText={setMyGames}
          keyboardType="numeric"
          maxLength={1}
        />
        <Text style={styles.scoreSep}>:</Text>
        <TextInput
          style={styles.scoreInput}
          placeholderTextColor={COLORS.textSecondary}
          placeholder="4"
          value={oppGames}
          onChangeText={setOppGames}
          keyboardType="numeric"
          maxLength={1}
        />
      </View>
      <Text style={styles.hint}>Допустимо: 6:0 — 6:4, 7:5, 7:6 (тай-брейк)</Text>

      {need76 && (
        <>
          <Text style={styles.label}>Тай-брейк (мои очки : сопернику)</Text>
          <View style={styles.scoreRow}>
            <TextInput
              style={styles.scoreInput}
              placeholderTextColor={COLORS.textSecondary}
              placeholder="7"
              value={myTb}
              onChangeText={setMyTb}
              keyboardType="numeric"
              maxLength={2}
            />
            <Text style={styles.scoreSep}>:</Text>
            <TextInput
              style={styles.scoreInput}
              placeholderTextColor={COLORS.textSecondary}
              placeholder="5"
              value={oppTb}
              onChangeText={setOppTb}
              keyboardType="numeric"
              maxLength={2}
            />
          </View>
        </>
      )}

      <Text style={styles.label}>Примечание</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholderTextColor={COLORS.textSecondary}
        placeholder="Корт, погода, комментарии..."
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.disabled]}
        onPress={submit}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color={COLORS.textLight} />
        ) : (
          <Text style={styles.buttonText}>Отправить на подтверждение</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md, paddingBottom: SPACING.xl},
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  hint: {fontSize: FONT_SIZE.xs, color: COLORS.disabled, marginTop: SPACING.xs},
  prefillBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  prefillName: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary},
  prefillHint: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2},
  chipsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm},
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  chipText: {fontSize: FONT_SIZE.sm, color: COLORS.text},
  chipTextActive: {color: COLORS.textLight},
  dateRow: {flexDirection: 'row', gap: SPACING.md},
  dateInput: {flex: 1},
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  textArea: {height: 80, textAlignVertical: 'top'},
  scoreRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm},
  scoreInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    textAlign: 'center',
    color: COLORS.text,
  },
  scoreSep: {fontSize: FONT_SIZE.xl, color: COLORS.textSecondary, fontWeight: '700'},
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  disabled: {opacity: 0.6},
  buttonText: {color: COLORS.textLight, fontSize: FONT_SIZE.md, fontWeight: '600'},
});
