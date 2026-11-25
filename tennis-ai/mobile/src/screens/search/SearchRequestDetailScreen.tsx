import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import {searchApi} from '../../api/search';
import {chatApi} from '../../api/chat';
import {SearchRequest, SearchResponseItem} from '../../types/search';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {formatDate, formatDateTime, formatTime, formatFullName} from '../../utils/format';
import {GAME_TYPE_LABELS} from '../../constants/levels';
import {extractErrorMessage} from '../../utils/format';

export default function SearchRequestDetailScreen({route, navigation}: any) {
  const {id} = route.params;
  const [sr, setSr] = useState<SearchRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [declineReason, setDeclineReason] = useState('');
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const user = useAuthStore(s => s.user);

  const load = async () => {
    try {
      const {data} = await searchApi.get(id);
      setSr(data);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <ActivityIndicator style={{flex: 1}} size="large" color={COLORS.primary} />;
  if (!sr) return <Text style={styles.empty}>Запрос не найден</Text>;

  const isAuthor = user?.id === sr.author_id;

  // «Записать счёт» logic: game time has passed + confirmed opponent exists
  const gameEnded = new Date(sr.end_time) < new Date();
  const confirmedResponse = sr.responses?.find(r => r.status === 'confirmed');
  const myConfirmedResponse = !isAuthor && sr.responses?.find(
    r => r.responder_id === user?.id && r.status === 'confirmed',
  );
  // The opponent for score entry
  const scoreOpponent = isAuthor
    ? confirmedResponse?.responder
    : sr.author;
  const canRecordScore = gameEnded && (
    (isAuthor && !!confirmedResponse) || !!myConfirmedResponse
  );

  const openScoreEntry = () => {
    if (!scoreOpponent) return;
    navigation.navigate('CreateMatch', {
      opponentId: scoreOpponent.id,
      opponentName: `${scoreOpponent.last_name} ${scoreOpponent.first_name}`,
      playedAt: sr.start_time,
    });
  };

  const openGameScoreEntry = () => {
    if (!scoreOpponent) return;
    navigation.navigate('CreateGameScore', {
      opponentId: scoreOpponent.id,
      opponentName: `${scoreOpponent.last_name} ${scoreOpponent.first_name}`,
      playedAt: sr.start_time,
    });
  };

  const handleRespond = async () => {
    try {
      await searchApi.respond(sr.id);
      Alert.alert('Готово', 'Вы откликнулись на предложение');
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось откликнуться'));
    }
  };

  const handleConfirm = async (respId: string, responderId: string, responderName: string) => {
    try {
      await searchApi.confirm(sr.id, respId);
      // Создаём/открываем чат с партнёром
      try {
        const {data: conv} = await chatApi.openConversation(responderId);
        await load();
        Vibration.vibrate(60);
        Alert.alert(
          '✅ Партнёр подтверждён',
          `Чат с ${responderName} открыт`,
          [
            {text: 'Открыть чат', onPress: () => {
              navigation.getParent()?.navigate('ChatTab', {
                screen: 'Chat',
                params: {conversationId: conv.id, peerName: responderName},
              });
            }},
            {text: 'Остаться', style: 'cancel'},
          ],
        );
      } catch {
        load();
      }
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Ошибка'));
    }
  };

  const handleDecline = async (respId: string) => {
    const reason = declineReason.trim();
    if (reason.length < 3) {
      Alert.alert(
        'Укажите причину',
        'Чтобы отклонить отклик, укажите причину (минимум 3 символа)',
      );
      return;
    }
    try {
      await searchApi.decline(sr.id, respId, reason);
      setDecliningId(null);
      setDeclineReason('');
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Ошибка'));
    }
  };

  const handleReset = async (respId: string) => {
    try {
      await searchApi.reset(sr.id, respId);
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Ошибка'));
    }
  };

  const renderResponse = (resp: SearchResponseItem) => {
    const statusLabels: Record<string, string> = {
      pending: 'Ожидает', confirmed: 'Подтвержден', declined: 'Отклонен', reset: 'Сброшен',
    };
    const statusColors: Record<string, string> = {
      pending: COLORS.warning, confirmed: COLORS.success, declined: COLORS.error, reset: COLORS.info,
    };

    return (
      <View key={resp.id} style={styles.responseCard}>
        <View style={styles.responseHeader}>
          <Text style={styles.responderName}>
            {formatFullName(resp.responder.last_name, resp.responder.first_name)}
          </Text>
          <Text style={[styles.respStatus, {color: statusColors[resp.status]}]}>
            {statusLabels[resp.status]}
          </Text>
        </View>
        <Text style={styles.respInfo}>СТМ: {resp.responder.stm_level}</Text>
        {resp.decline_reason && (
          <Text style={styles.respReason}>Причина: {resp.decline_reason}</Text>
        )}
        {isAuthor && (resp.status === 'pending' || resp.status === 'reset') && (
          <View>
            <View style={styles.respActions}>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => handleConfirm(
                  resp.id,
                  resp.responder.id,
                  formatFullName(resp.responder.last_name, resp.responder.first_name),
                )}>
                <Text style={styles.confirmText}>Подтвердить</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.declineBtn}
                onPress={() => {
                  setDecliningId(decliningId === resp.id ? null : resp.id);
                  setDeclineReason('');
                }}>
                <Text style={styles.declineText}>
                  {decliningId === resp.id ? 'Отмена' : 'Отклонить'}
                </Text>
              </TouchableOpacity>
            </View>
            {decliningId === resp.id && (
              <View style={styles.declineForm}>
                <Text style={styles.declineHint}>
                  Укажите причину отказа (обязательно)
                </Text>
                <TextInput
                  style={styles.declineInput}
                  placeholder="Например: не подходит время"
                  placeholderTextColor={COLORS.textSecondary}
                  value={declineReason}
                  onChangeText={setDeclineReason}
                  multiline
                />
                <TouchableOpacity
                  style={[
                    styles.declineSubmit,
                    declineReason.trim().length < 3 && styles.disabled,
                  ]}
                  onPress={() => handleDecline(resp.id)}
                  disabled={declineReason.trim().length < 3}>
                  <Text style={styles.declineText}>Отправить отказ</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        {isAuthor && (resp.status === 'confirmed' || resp.status === 'declined') && (
          <TouchableOpacity style={styles.resetBtn} onPress={() => handleReset(resp.id)}>
            <Text style={styles.resetText}>Редактировать</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoCard}>
        <View style={styles.infoCardHeader}>
          <Text style={styles.gameType}>{GAME_TYPE_LABELS[sr.game_type]}</Text>
          {isAuthor && sr.is_active && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate('EditSearch', {searchRequest: sr})}>
              <Text style={styles.editBtnText}>✏️ Редактировать</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.author}>
          {formatFullName(sr.author.last_name, sr.author.first_name)} (СТМ: {sr.author.stm_level})
        </Text>
        {sr.open_date ? (
          <Text style={styles.openDate}>📅 Открытая дата</Text>
        ) : (
          <Text style={styles.time}>
            {formatDate(sr.start_time)}, {formatTime(sr.start_time)} — {formatTime(sr.end_time)}
          </Text>
        )}
        {sr.court_booked && (
          <View style={styles.courtBookedBlock}>
            <Text style={styles.bookedLabel}>🏟️ Корт забронирован</Text>
            {(sr.location_name || sr.court_name) && (
              <Text style={styles.bookedDetail}>
                {[sr.location_name, sr.court_name].filter(Boolean).join(' · ')}
              </Text>
            )}
            {(sr.booking_date || sr.booking_slot_start) && (
              <Text style={styles.bookedTime}>
                {sr.booking_date
                  ? sr.booking_date.split('-').reverse().join('.')
                  : ''}
                {sr.booking_slot_start
                  ? `  ${sr.booking_slot_start}–${sr.booking_slot_end ?? '??'}`
                  : ''}
              </Text>
            )}
          </View>
        )}
        {sr.only_preferred && <Text style={styles.onlyPref}>🔒 Только друзья</Text>}
        {sr.notes && <Text style={styles.notes}>{sr.notes}</Text>}
        <Text style={styles.date}>Создан: {formatDateTime(sr.created_at)}</Text>
        <Text style={styles.counter}>
          Подтверждено: {sr.confirmed_count} / {sr.max_players}
        </Text>
      </View>

      {canRecordScore && (
        <View style={styles.scoreBtnsRow}>
          <TouchableOpacity style={[styles.scoreBtn, styles.scoreBtnHalf]} onPress={openScoreEntry}>
            <Text style={styles.scoreBtnText}>🎾 Счёт игры</Text>
            <Text style={styles.scoreBtnSub}>сеты / матч</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.scoreBtn, styles.scoreBtnHalf, styles.scoreBtnGame]} onPress={openGameScoreEntry}>
            <Text style={styles.scoreBtnText}>🎯 Счёт гейма</Text>
            <Text style={styles.scoreBtnSub}>очки в гейме</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isAuthor && (() => {
        const myResponse = sr.responses?.find(r => r.responder_id === user?.id);
        if (myResponse) {
          const isConfirmed = myResponse.status === 'confirmed';
          const statusLabel: Record<string, string> = {
            pending: 'Вы откликнулись — ожидание',
            confirmed: '✅ Вы участвуете в матче!',
            declined: 'Автор отклонил ваш отклик',
            reset: 'Статус сброшен',
          };
          const openChat = async () => {
            try {
              const {data: conv} = await chatApi.openConversation(sr.author_id);
              navigation.getParent()?.navigate('ChatTab', {
                screen: 'Chat',
                params: {
                  conversationId: conv.id,
                  peerName: formatFullName(sr.author.last_name, sr.author.first_name),
                },
              });
            } catch {
              Alert.alert('Ошибка', 'Не удалось открыть чат');
            }
          };
          return (
            <View style={[styles.myResponseInfo, isConfirmed && styles.myResponseConfirmed]}>
              <Text style={[styles.myResponseText, isConfirmed && styles.myResponseTextConfirmed]}>
                {statusLabel[myResponse.status] || myResponse.status}
              </Text>
              {isConfirmed && (
                <TouchableOpacity style={styles.chatBtn} onPress={openChat}>
                  <Text style={styles.chatBtnText}>💬 Написать партнёру</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }
        if (!sr.is_active) return null;
        return (
          <TouchableOpacity style={styles.respondBtn} onPress={handleRespond}>
            <Text style={styles.respondText}>Принять предложение</Text>
          </TouchableOpacity>
        );
      })()}

      {sr.responses && sr.responses.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Отклики ({sr.responses.length})</Text>
          {sr.responses.map(renderResponse)}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md},
  empty: {textAlign: 'center', marginTop: SPACING.xl, color: COLORS.textSecondary},
  infoCard: {backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.md},
  infoCardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  gameType: {fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.primary, flex: 1},
  editBtn: {paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: 8, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border},
  editBtnText: {fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '600'},
  author: {fontSize: FONT_SIZE.md, color: COLORS.text, marginTop: 4},
  time: {fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text, marginTop: SPACING.sm},
  openDate: {fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600', marginTop: SPACING.sm},
  onlyPref: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2},
  booked: {fontSize: FONT_SIZE.sm, color: COLORS.secondary, marginTop: 4},
  courtBookedBlock: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  bookedLabel: {fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.success},
  bookedDetail: {fontSize: FONT_SIZE.sm, color: COLORS.text, marginTop: 2},
  bookedTime: {fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.primary, marginTop: 2},
  notes: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.sm, fontStyle: 'italic'},
  date: {fontSize: FONT_SIZE.xs, color: COLORS.disabled, marginTop: SPACING.sm},
  counter: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.success, marginTop: SPACING.sm},
  respondBtn: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  respondText: {color: COLORS.textLight, fontSize: FONT_SIZE.md, fontWeight: '600'},
  sectionTitle: {fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm},
  responseCard: {backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.sm},
  responseHeader: {flexDirection: 'row', justifyContent: 'space-between'},
  responderName: {fontSize: FONT_SIZE.md, fontWeight: '500'},
  respStatus: {fontSize: FONT_SIZE.sm, fontWeight: '600'},
  respInfo: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2},
  respReason: {fontSize: FONT_SIZE.sm, color: COLORS.error, marginTop: 4},
  respActions: {flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm},
  confirmBtn: {
    flex: 1,
    backgroundColor: COLORS.success,
    padding: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmText: {color: COLORS.textLight, fontWeight: '600'},
  declineBtn: {
    flex: 1,
    backgroundColor: COLORS.error,
    padding: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  declineText: {color: COLORS.textLight, fontWeight: '600'},
  declineForm: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    gap: SPACING.xs,
  },
  declineHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  declineInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.sm,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  declineSubmit: {
    backgroundColor: COLORS.error,
    padding: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabled: {opacity: 0.5},
  resetBtn: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.info,
    alignItems: 'center',
  },
  resetText: {color: COLORS.info, fontWeight: '600'},
  myResponseInfo: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  myResponseConfirmed: {
    backgroundColor: '#E8F5E9',
    borderColor: COLORS.success,
  },
  myResponseText: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary},
  myResponseTextConfirmed: {color: COLORS.success},
  chatBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 20,
  },
  chatBtnText: {color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md},
  scoreBtnsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  scoreBtn: {
    backgroundColor: COLORS.secondary,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  scoreBtnHalf: {
    flex: 1,
    marginBottom: 0,
  },
  scoreBtnGame: {
    backgroundColor: COLORS.primary,
  },
  scoreBtnText: {color: COLORS.textLight, fontSize: FONT_SIZE.md, fontWeight: '700'},
  scoreBtnSub: {color: COLORS.textLight, fontSize: FONT_SIZE.xs, opacity: 0.8, marginTop: 2},
});
