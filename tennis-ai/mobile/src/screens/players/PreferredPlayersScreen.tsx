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
import {preferredPlayersApi, playerRequestApi} from '../../api/feed';
import {chatApi} from '../../api/chat';
import {PreferredPlayer, PlayerRequest} from '../../types/feed';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage} from '../../utils/format';

export default function PreferredPlayersScreen({navigation}: any) {
  const [players, setPlayers] = useState<PreferredPlayer[]>([]);
  const [incoming, setIncoming] = useState<PlayerRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [playersRes, incomingRes] = await Promise.all([
        preferredPlayersApi.list(),
        playerRequestApi.getIncoming(),
      ]);
      setPlayers(playersRes.data);
      setIncoming(incomingRes.data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await preferredPlayersApi.update(id, !current);
      setPlayers(prev => prev.map(p => p.id === id ? {...p, is_active: !current} : p));
    } catch {}
  };

  const acceptRequest = async (id: string) => {
    try {
      await playerRequestApi.accept(id);
      Alert.alert('Готово', 'Игрок добавлен');
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Ошибка'));
    }
  };

  const declineRequest = async (id: string) => {
    try {
      await playerRequestApi.decline(id);
      load();
    } catch {}
  };

  const openChat = async (p: PreferredPlayer) => {
    try {
      const {data: conv} = await chatApi.openConversation(p.player.id);
      navigation.getParent()?.navigate('ChatTab', {
        screen: 'Chat',
        params: {
          conversationId: conv.id,
          peerName: `${p.player.last_name} ${p.player.first_name}`,
        },
      });
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось открыть чат'));
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={[]}
        renderItem={() => null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>‹ Назад в профиль</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Моя игра</Text>
            <View style={styles.tileGrid}>
              {[
                {icon: '🎾', label: 'Сеты', sub: 'История матчей', screen: 'MyMatches'},
                {icon: '🎯', label: 'Геймы', sub: 'Счёт по геймам', screen: 'MyGameScores'},
                {icon: '🏆', label: 'Рейтинг Elo', sub: 'Место в клубе', screen: 'Rankings'},
                {icon: '📊', label: 'Прогресс', sub: 'Отчёты и графики', screen: 'Reports'},
              ].map(t => (
                <TouchableOpacity
                  key={t.screen}
                  style={styles.tile}
                  onPress={() => navigation.navigate(t.screen)}>
                  <Text style={styles.tileIcon}>{t.icon}</Text>
                  <Text style={styles.tileLabel}>{t.label}</Text>
                  <Text style={styles.tileSub}>{t.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>События</Text>
            <View style={styles.tileGrid}>
              {[
                {icon: '🏅', label: 'Турниры', sub: 'Соревнования клуба', screen: 'CompetitionsList'},
                {icon: '👨‍🏫', label: 'Тренировки', sub: 'Занятия с тренером', screen: 'TrainingsList'},
              ].map(t => (
                <TouchableOpacity
                  key={t.screen}
                  style={styles.tile}
                  onPress={() => navigation.navigate(t.screen)}>
                  <Text style={styles.tileIcon}>{t.icon}</Text>
                  <Text style={styles.tileLabel}>{t.label}</Text>
                  <Text style={styles.tileSub}>{t.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.qrRow}>
              <TouchableOpacity
                style={styles.qrBtn}
                onPress={() => navigation.navigate('MyQR')}>
                <Text style={styles.qrBtnText}>📲  Мой QR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.qrBtn, styles.qrBtnScan]}
                onPress={() => navigation.navigate('QRScan')}>
                <Text style={styles.qrBtnText}>📷  Сканировать</Text>
              </TouchableOpacity>
            </View>

            {incoming.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Входящие запросы</Text>
                {incoming.map(req => (
                  <View key={req.id} style={styles.requestCard}>
                    <Text style={styles.reqName}>
                      {req.requester.last_name} {req.requester.first_name}
                    </Text>
                    <Text style={styles.reqPhone}>Тел: {req.target_phone}</Text>
                    <View style={styles.reqActions}>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(req.id)}>
                        <Text style={styles.acceptText}>Принять</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.declineBtn} onPress={() => declineRequest(req.id)}>
                        <Text style={styles.declineText}>Отклонить</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            <Text style={styles.sectionTitle}>
              Друзья ({players.length})
            </Text>
            {players.length === 0 && (
              <Text style={styles.empty}>Список пуст. Добавьте друзей по номеру телефона.</Text>
            )}
            {players.map(p => (
              <View key={p.id} style={styles.playerCard}>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>
                    {p.player.last_name} {p.player.first_name}
                  </Text>
                  <Text style={styles.playerStm}>СТМ: {p.player.stm_level}</Text>
                </View>
                <TouchableOpacity
                  style={styles.chatBtn}
                  onPress={() => openChat(p)}>
                  <Text style={styles.chatBtnText}>💬</Text>
                </TouchableOpacity>
                <Switch
                  value={p.is_active}
                  onValueChange={() => toggleActive(p.id, p.is_active)}
                  trackColor={{true: COLORS.primaryLight}}
                />
              </View>
            ))}
          </>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddPlayer')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  sectionTitle: {
    fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  empty: {
    paddingHorizontal: SPACING.md, color: COLORS.textSecondary, fontSize: FONT_SIZE.sm,
  },
  requestCard: {
    backgroundColor: '#FFF3E0', borderRadius: 12, padding: SPACING.md,
    marginHorizontal: SPACING.sm, marginBottom: SPACING.sm,
  },
  reqName: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text},
  reqPhone: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2},
  reqActions: {flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm},
  acceptBtn: {flex: 1, backgroundColor: COLORS.success, padding: SPACING.sm, borderRadius: 8, alignItems: 'center'},
  acceptText: {color: COLORS.textLight, fontWeight: '600'},
  declineBtn: {flex: 1, backgroundColor: COLORS.error, padding: SPACING.sm, borderRadius: 8, alignItems: 'center'},
  declineText: {color: COLORS.textLight, fontWeight: '600'},
  playerCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md,
    marginHorizontal: SPACING.sm, marginBottom: SPACING.sm,
  },
  playerInfo: {flex: 1},
  playerName: {fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text},
  playerStm: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary},
  chatBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginRight: SPACING.sm,
  },
  chatBtnText: {fontSize: 22},
  fab: {
    position: 'absolute', bottom: SPACING.lg, right: SPACING.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', elevation: 4,
    shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabText: {fontSize: 28, color: COLORS.textLight, marginTop: -2},
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  tile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tileIcon: {fontSize: 26},
  tileLabel: {fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginTop: 6},
  tileSub: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2},
  qrRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  qrBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  qrBtnScan: {
    backgroundColor: COLORS.primary + '22',
  },
  qrBtnText: {color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '600'},
  backBtn: {paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm},
  backBtnText: {fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600'},
});
