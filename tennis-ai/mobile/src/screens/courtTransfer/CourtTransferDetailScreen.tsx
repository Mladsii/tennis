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
} from 'react-native';
import {courtTransferApi} from '../../api/feed';
import {CourtTransferDetail, CourtTransferResponseItem} from '../../types/feed';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {formatDate, formatDateTime, formatTime, formatFullName} from '../../utils/format';
import {extractErrorMessage} from '../../utils/format';

export default function CourtTransferDetailScreen({route}: any) {
  const {id} = route.params;
  const [ct, setCt] = useState<CourtTransferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [declineReason, setDeclineReason] = useState('');
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const user = useAuthStore(s => s.user);

  const load = async () => {
    try {
      const {data} = await courtTransferApi.get(id);
      setCt(data);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <ActivityIndicator style={{flex: 1}} size="large" color={COLORS.primary} />;
  if (!ct) return <Text style={styles.empty}>Передача не найдена</Text>;

  const isAuthor = user?.id === ct.author_id;

  const handleRespond = async () => {
    try {
      await courtTransferApi.respond(ct.id);
      Alert.alert('Готово', 'Вы откликнулись на корт');
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось откликнуться'));
    }
  };

  const handleConfirm = async (respId: string) => {
    try {
      await courtTransferApi.confirm(ct.id, respId);
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Ошибка'));
    }
  };

  const handleDecline = async (respId: string) => {
    try {
      await courtTransferApi.decline(ct.id, respId, declineReason || undefined);
      setDecliningId(null);
      setDeclineReason('');
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Ошибка'));
    }
  };

  const renderResponse = (resp: CourtTransferResponseItem) => {
    const statusLabels: Record<string, string> = {
      pending: 'Ожидает', confirmed: 'Подтвержден', declined: 'Отклонен',
    };
    const statusColors: Record<string, string> = {
      pending: COLORS.warning, confirmed: COLORS.success, declined: COLORS.error,
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
        {resp.decline_reason && (
          <Text style={styles.respReason}>Причина: {resp.decline_reason}</Text>
        )}
        {isAuthor && resp.status === 'pending' && (
          <View style={styles.respActions}>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => handleConfirm(resp.id)}>
              <Text style={styles.confirmText}>Подтвердить</Text>
            </TouchableOpacity>
            {decliningId === resp.id ? (
              <View style={styles.declineForm}>
                <TextInput
                  style={styles.declineInput}
                  placeholder="Причина отказа"
                  placeholderTextColor={COLORS.textSecondary}
                  value={declineReason}
                  onChangeText={setDeclineReason}
                />
                <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(resp.id)}>
                  <Text style={styles.declineText}>Отказать</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.declineBtn} onPress={() => setDecliningId(resp.id)}>
                <Text style={styles.declineText}>Отклонить</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoCard}>
        <Text style={styles.title}>{ct.is_paid ? 'Платная передача' : 'Бесплатная передача'}</Text>
        <Text style={styles.author}>
          {formatFullName(ct.author.last_name, ct.author.first_name)}
        </Text>
        <Text style={styles.time}>
          {formatDate(ct.start_time)}, {formatTime(ct.start_time)} — {formatTime(ct.end_time)}
        </Text>
        {ct.notes && <Text style={styles.notes}>{ct.notes}</Text>}
        <Text style={styles.date}>Создан: {formatDateTime(ct.created_at)}</Text>
        {!ct.is_active && <Text style={styles.closedLabel}>Закрыт</Text>}
      </View>

      {!isAuthor && ct.is_active && (() => {
        const myResponse = ct.responses?.find(r => r.responder_id === user?.id);
        if (myResponse) {
          const statusLabel: Record<string, string> = {
            pending: 'Вы откликнулись — ожидание',
            confirmed: 'Корт за вами!',
            declined: 'Автор отклонил ваш запрос',
          };
          return (
            <View style={styles.myResponseInfo}>
              <Text style={styles.myResponseText}>
                {statusLabel[myResponse.status] || myResponse.status}
              </Text>
            </View>
          );
        }
        return (
          <TouchableOpacity style={styles.respondBtn} onPress={handleRespond}>
            <Text style={styles.respondText}>Забронировать корт</Text>
          </TouchableOpacity>
        );
      })()}

      {ct.responses && ct.responses.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Отклики ({ct.responses.length})</Text>
          {ct.responses.map(renderResponse)}
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
  title: {fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.primary},
  author: {fontSize: FONT_SIZE.md, color: COLORS.text, marginTop: 4},
  time: {fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text, marginTop: SPACING.sm},
  notes: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.sm, fontStyle: 'italic'},
  date: {fontSize: FONT_SIZE.xs, color: COLORS.disabled, marginTop: SPACING.sm},
  closedLabel: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.error, marginTop: SPACING.sm},
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
  respReason: {fontSize: FONT_SIZE.sm, color: COLORS.error, marginTop: 4},
  respActions: {flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm},
  confirmBtn: {
    flex: 1, backgroundColor: COLORS.success, padding: SPACING.sm, borderRadius: 8, alignItems: 'center',
  },
  confirmText: {color: COLORS.textLight, fontWeight: '600'},
  declineBtn: {
    flex: 1, backgroundColor: COLORS.error, padding: SPACING.sm, borderRadius: 8, alignItems: 'center',
  },
  declineText: {color: COLORS.textLight, fontWeight: '600'},
  declineForm: {flex: 1, gap: SPACING.xs},
  declineInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SPACING.xs, fontSize: FONT_SIZE.sm, color: COLORS.text,
  },
  myResponseInfo: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md, alignItems: 'center',
    marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.primary,
  },
  myResponseText: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary},
});
