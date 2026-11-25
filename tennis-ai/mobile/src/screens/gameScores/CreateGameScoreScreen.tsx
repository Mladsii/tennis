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
import {gameScoresApi} from '../../api/gameScores';
import {preferredPlayersApi} from '../../api/feed';
import {PreferredPlayer} from '../../types/feed';
import {PointValue} from '../../types/gameScore';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage} from '../../utils/format';

const POINTS: PointValue[] = ['0', '15', '30', '40', 'Ad'];

export default function CreateGameScoreScreen({navigation, route}: any) {
  const me = useAuthStore(s => s.user);
  const prefillOpponentId: string | undefined = route?.params?.opponentId;
  const prefillOpponentName: string | undefined = route?.params?.opponentName;
  const prefillPlayedAt: string | undefined = route?.params?.playedAt;

  const [opponents, setOpponents] = useState<PreferredPlayer[]>([]);
  const [opponentId, setOpponentId] = useState(prefillOpponentId ?? '');
  const [opponentName, setOpponentName] = useState(prefillOpponentName ?? '');
  const [serverIsMe, setServerIsMe] = useState(true);
  const [myPts, setMyPts] = useState<PointValue>('0');
  const [oppPts, setOppPts] = useState<PointValue>('0');
  const [notes, setNotes] = useState('');

  const [date, setDate] = useState(() =>
    prefillPlayedAt ? prefillPlayedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [time, setTime] = useState(() => {
    if (prefillPlayedAt) return prefillPlayedAt.slice(11, 16);
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    preferredPlayersApi
      .list()
      .then(({data}) => setOpponents(data.filter(p => p.is_active)))
      .catch(() => {});
  }, []);

  // Validate Ad rules: only one player can have Ad, and only if other has 40
  const adValid = (() => {
    const hasAd = myPts === 'Ad' || oppPts === 'Ad';
    if (!hasAd) return true;
    if (myPts === 'Ad' && oppPts === '40') return true;
    if (oppPts === 'Ad' && myPts === '40') return true;
    return false;
  })();

  const submit = async () => {
    if (!opponentId) return Alert.alert('Ошибка', 'Выберите соперника');
    if (!adValid) return Alert.alert('Ошибка', 'Преимущество (Ad) возможно только при 40 у соперника');
    setLoading(true);
    try {
      const playedAt = new Date(`${date}T${time}:00`).toISOString();
      await gameScoresApi.create({
        opponent_id: opponentId,
        server_id: serverIsMe ? me!.id : opponentId,
        played_at: playedAt,
        creator_points: myPts,
        opponent_points: oppPts,
        notes: notes || null,
      });
      Alert.alert('Готово', 'Счёт гейма отправлен сопернику на подтверждение');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось сохранить'));
    } finally {
      setLoading(false);
    }
  };

  const PointsRow = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: PointValue;
    onChange: (v: PointValue) => void;
  }) => (
    <View style={styles.pointsBlock}>
      <Text style={styles.pointsLabel}>{label}</Text>
      <View style={styles.pointsRow}>
        {POINTS.map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.pointBtn, value === p && styles.pointBtnActive]}
            onPress={() => onChange(p)}>
            <Text style={[styles.pointText, value === p && styles.pointTextActive]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Записать счёт гейма</Text>
      <Text style={styles.hint}>Незавершённый гейм: текущие очки + кто подаёт</Text>

      <Text style={styles.label}>Соперник</Text>
      {prefillOpponentId ? (
        <View style={styles.prefillBox}>
          <Text style={styles.prefillName}>{opponentName}</Text>
          <Text style={styles.prefillHint}>из подтверждённого поиска</Text>
        </View>
      ) : opponents.length === 0 ? (
        <Text style={styles.hint}>Сначала добавьте друзей.</Text>
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
          <Text style={styles.label}>Дата</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-04-27"
            placeholderTextColor={COLORS.textSecondary}
            value={date}
            onChangeText={setDate}
          />
        </View>
        <View style={styles.dateInput}>
          <Text style={styles.label}>Время</Text>
          <TextInput
            style={styles.input}
            placeholder="19:30"
            placeholderTextColor={COLORS.textSecondary}
            value={time}
            onChangeText={setTime}
          />
        </View>
      </View>

      <Text style={styles.label}>Кто подаёт</Text>
      <View style={styles.serverRow}>
        <TouchableOpacity
          style={[styles.serverBtn, serverIsMe && styles.serverBtnActive]}
          onPress={() => setServerIsMe(true)}>
          <Text style={[styles.serverText, serverIsMe && styles.serverTextActive]}>
            🎾 Я подаю
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.serverBtn, !serverIsMe && styles.serverBtnActive]}
          onPress={() => setServerIsMe(false)}>
          <Text style={[styles.serverText, !serverIsMe && styles.serverTextActive]}>
            Соперник подаёт
          </Text>
        </TouchableOpacity>
      </View>

      <PointsRow label="Мои очки" value={myPts} onChange={setMyPts} />
      <PointsRow label="Очки соперника" value={oppPts} onChange={setOppPts} />

      {!adValid && (
        <Text style={styles.error}>
          Ad возможно только когда у второго игрока 40
        </Text>
      )}

      <Text style={styles.label}>Примечание</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Корт, погода, комментарии..."
        placeholderTextColor={COLORS.textSecondary}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <TouchableOpacity
        style={[styles.submit, loading && styles.disabled]}
        disabled={loading}
        onPress={submit}>
        {loading ? (
          <ActivityIndicator color={COLORS.textLight} />
        ) : (
          <Text style={styles.submitText}>Отправить на подтверждение</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md, paddingBottom: SPACING.xl},
  title: {fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.primary},
  hint: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 4},
  error: {fontSize: FONT_SIZE.sm, color: COLORS.error, marginTop: SPACING.sm},
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
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
  dateRow: {flexDirection: 'row', gap: SPACING.md},
  dateInput: {flex: 1},
  serverRow: {flexDirection: 'row', gap: SPACING.sm},
  serverBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
  },
  serverBtnActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  serverText: {fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '600'},
  serverTextActive: {color: COLORS.textLight},
  pointsBlock: {marginTop: SPACING.md},
  pointsLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  pointsRow: {flexDirection: 'row', gap: SPACING.xs},
  pointBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  pointBtnActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  pointText: {fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text},
  pointTextActive: {color: COLORS.textLight},
  submit: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  disabled: {opacity: 0.6},
  submitText: {color: COLORS.textLight, fontSize: FONT_SIZE.md, fontWeight: '700'},
});
