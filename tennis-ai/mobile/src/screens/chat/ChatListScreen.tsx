import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {chatApi} from '../../api/chat';
import {chatWs} from '../../api/chatWs';
import {Conversation} from '../../types/chat';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {formatTime, formatDate} from '../../utils/format';
import dayjs from 'dayjs';

function lastMessagePreview(c: Conversation): string {
  const m = c.last_message;
  if (!m) return 'Нет сообщений';
  if (m.deleted_at) return 'Сообщение удалено';
  return m.body;
}

function formatLastTs(iso: string | null): string {
  if (!iso) return '';
  const d = dayjs(iso);
  if (d.isSame(dayjs(), 'day')) return formatTime(iso);
  return formatDate(iso);
}

export default function ChatListScreen({navigation}: any) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const {data} = await chatApi.listConversations();
      setItems(data);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    chatWs.connect();
    const unsub = chatWs.subscribe(() => load());
    return () => {
      unsub();
    };
  }, [load]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({item}: {item: Conversation}) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() =>
        navigation.navigate('Chat', {
          conversationId: item.id,
          peerName: item.peer.full_name,
        })
      }>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(item.peer.full_name || '?')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={styles.name} numberOfLines={1}>
            {item.peer.full_name || item.peer.phone}
          </Text>
          <Text style={styles.ts}>{formatLastTs(item.last_message_at)}</Text>
        </View>
        <View style={styles.bottomLine}>
          <Text style={styles.preview} numberOfLines={1}>
            {lastMessagePreview(item)}
          </Text>
          {item.unread_count > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Пока нет диалогов. Откройте список игроков и нажмите «Написать».
          </Text>
        }
        contentContainerStyle={items.length === 0 ? styles.emptyWrap : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  row: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {color: COLORS.textLight, fontSize: FONT_SIZE.lg, fontWeight: '600'},
  body: {flex: 1},
  topLine: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  name: {flex: 1, fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text},
  ts: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginLeft: SPACING.sm},
  bottomLine: {flexDirection: 'row', alignItems: 'center', marginTop: 2},
  preview: {flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary},
  badge: {
    backgroundColor: COLORS.primary,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  badgeText: {color: COLORS.textLight, fontSize: FONT_SIZE.xs, fontWeight: '600'},
  empty: {textAlign: 'center', color: COLORS.textSecondary, padding: SPACING.lg},
  emptyWrap: {flexGrow: 1, justifyContent: 'center'},
});
