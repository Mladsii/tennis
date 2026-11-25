import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import api from '../../api/client';
import {matchesApi} from '../../api/matches';
import {UserPublic} from '../../types/user';
import {MatchSet} from '../../types/match';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {formatDate} from '../../utils/format';

function StatBox({value, label, color}: {value: string | number; label: string; color?: string}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, color ? {color} : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function PlayerProfileScreen({route, navigation}: any) {
  const {userId} = route.params as {userId: string};
  const me = useAuthStore(s => s.user);

  const [player, setPlayer] = useState<UserPublic | null>(null);
  const [matches, setMatches] = useState<MatchSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [userRes, matchRes] = await Promise.all([
        api.get<UserPublic>(`/users/${userId}`),
        matchesApi.list(),
      ]);
      setPlayer(userRes.data);
      // Filter matches involving this player
      const relevant = matchRes.data.filter(
        m =>
          (m.creator_id === userId || m.opponent_id === userId) &&
          m.status === 'confirmed',
      );
      setMatches(relevant.slice(0, 10));
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить профиль');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />;
  }
  if (!player) {
    return <Text style={styles.empty}>Игрок не найден</Text>;
  }

  // Compute head-to-head vs me
  const meId = me?.id;
  const vsMe = matches.filter(
    m =>
      (m.creator_id === meId || m.opponent_id === meId) &&
      (m.creator_id === userId || m.opponent_id === userId),
  );
  const myWins = vsMe.filter(m => {
    const iCreator = m.creator_id === meId;
    const myGames = iCreator ? m.creator_games : m.opponent_games;
    const theirGames = iCreator ? m.opponent_games : m.creator_games;
    return myGames > theirGames;
  }).length;

  const genderIcon = player.gender === 'M' ? '♂' : '♀';
  const ntrpLabels: Record<string, string> = {
    beginner: 'Начинающий',
    intermediate: 'Любитель',
    advanced: 'Продвинутый',
    professional: 'Профессионал',
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(player.first_name[0] ?? '') + (player.last_name[0] ?? '')}
          </Text>
        </View>
        <View style={{flex: 1}}>
          <Text style={styles.playerName}>
            {player.last_name} {player.first_name}
          </Text>
          {player.nickname ? (
            <Text style={styles.nickname}>@{player.nickname}  {genderIcon}</Text>
          ) : null}
          <Text style={styles.meta}>
            {ntrpLabels[player.ntrp_level] ?? player.ntrp_level}
            {player.years_playing ? `  ·  ${player.years_playing} лет` : ''}
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsCard}>
        <StatBox value={player.elo_rating} label="Elo" color={COLORS.primary} />
        <View style={styles.statDivider} />
        <StatBox value={player.stm_level} label="СТМ" />
        {vsMe.length > 0 && (
          <>
            <View style={styles.statDivider} />
            <StatBox
              value={`${myWins}–${vsMe.length - myWins}`}
              label="Личные встречи"
              color={myWins > vsMe.length - myWins ? COLORS.success : COLORS.error}
            />
          </>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() =>
            navigation.navigate('CreateMatch', {
              opponentId: player.id,
              opponentName: `${player.last_name} ${player.first_name}`,
            })
          }>
          <Text style={styles.actionBtnText}>🎾 Матч</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() =>
            navigation.navigate('Chat' as any, {
              peerId: player.id,
              peerName: `${player.last_name} ${player.first_name}`,
            })
          }>
          <Text style={styles.actionBtnText}>💬 Чат</Text>
        </TouchableOpacity>
      </View>

      {/* Recent matches */}
      {matches.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Последние матчи</Text>
          {matches.map(m => {
            const iCreator = m.creator_id === meId;
            const myGames = iCreator ? m.creator_games : m.opponent_games;
            const theirGames = iCreator ? m.opponent_games : m.creator_games;
            const won = myGames > theirGames;
            const scoreStr = iCreator
              ? `${m.creator_games}:${m.opponent_games}`
              : `${m.opponent_games}:${m.creator_games}`;
            // Other player in match (could be vs someone else)
            const other =
              m.creator_id === meId
                ? `${m.opponent.last_name} ${m.opponent.first_name[0]}.`
                : `${m.creator.last_name} ${m.creator.first_name[0]}.`;
            return (
              <View key={m.id} style={styles.matchRow}>
                <View style={[styles.matchBadge, {backgroundColor: won ? COLORS.success : COLORS.error}]}>
                  <Text style={styles.matchBadgeText}>{won ? 'П' : 'П'}{won ? 'обеда' : 'ораж.'}</Text>
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.matchOpponent}>{other}</Text>
                  <Text style={styles.matchDate}>{formatDate(m.played_at)}</Text>
                </View>
                <Text style={[styles.matchScore, {color: won ? COLORS.success : COLORS.error}]}>
                  {scoreStr}
                </Text>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md},
  center: {flex: 1},
  empty: {textAlign: 'center', marginTop: 60, color: COLORS.textSecondary},

  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {fontSize: 22, fontWeight: '800', color: COLORS.textLight},
  playerName: {fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text},
  nickname: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2},
  meta: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 4},

  statsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statBox: {alignItems: 'center', flex: 1},
  statValue: {fontSize: 22, fontWeight: '800', color: COLORS.text},
  statLabel: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 4},
  statDivider: {width: 1, height: 36, backgroundColor: COLORS.border},

  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnText: {fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.primary},

  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  matchRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  matchBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  matchBadgeText: {fontSize: 10, fontWeight: '700', color: '#fff'},
  matchOpponent: {fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text},
  matchDate: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2},
  matchScore: {fontSize: FONT_SIZE.lg, fontWeight: '800'},
});
