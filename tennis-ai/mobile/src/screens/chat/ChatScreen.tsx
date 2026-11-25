import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import dayjs from 'dayjs';
import {chatApi} from '../../api/chat';
import {chatWs} from '../../api/chatWs';
import {Message, ChatWsEvent} from '../../types/chat';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {formatTime} from '../../utils/format';

const EDIT_WINDOW_MIN = 5;

export default function ChatScreen({route, navigation}: any) {
  const {conversationId, peerName} = route.params;
  const me = useAuthStore(s => s.user);
  const myId = me?.id;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    navigation.setOptions({title: peerName || 'Чат'});
  }, [navigation, peerName]);

  const load = useCallback(async () => {
    try {
      const {data} = await chatApi.getMessages(conversationId);
      setMessages(data.slice().reverse());
      await chatApi.markRead(conversationId).catch(() => {});
    } catch {}
  }, [conversationId]);

  useEffect(() => {
    load();
    chatWs.connect();
    const handler = (ev: ChatWsEvent) => {
      if ('conversation_id' in ev && ev.conversation_id !== conversationId) return;
      if (ev.type === 'message.created') {
        setMessages(prev => {
          if (prev.some(m => m.id === ev.message.id)) return prev;
          return [...prev, ev.message];
        });
        if (ev.message.sender_id !== myId) {
          chatApi.markRead(conversationId).catch(() => {});
        }
      } else if (ev.type === 'message.edited') {
        setMessages(prev =>
          prev.map(m => (m.id === ev.message.id ? ev.message : m)),
        );
      } else if (ev.type === 'message.deleted') {
        setMessages(prev =>
          prev.map(m =>
            m.id === ev.message_id
              ? {...m, deleted_at: new Date().toISOString(), body: ''}
              : m,
          ),
        );
      } else if (ev.type === 'messages.read') {
        if (ev.by_user_id !== myId) {
          setMessages(prev =>
            prev.map(m =>
              m.sender_id === myId && !m.is_read ? {...m, is_read: true} : m,
            ),
          );
        }
      }
    };
    const unsub = chatWs.subscribe(handler);
    return unsub;
  }, [conversationId, load, myId]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      chatApi.markRead(conversationId).catch(() => {});
    });
    return unsub;
  }, [navigation, conversationId]);

  const send = async () => {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (editingId) {
        await chatApi.editMessage(editingId, body);
        setEditingId(null);
      } else {
        await chatApi.sendMessage(conversationId, body);
      }
      setInput('');
    } catch (e: any) {
      Alert.alert('Ошибка', 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  };

  const canEdit = (m: Message) =>
    m.sender_id === myId &&
    !m.deleted_at &&
    dayjs().diff(dayjs(m.created_at), 'minute') < EDIT_WINDOW_MIN;

  const onLongPress = (m: Message) => {
    if (m.sender_id !== myId || m.deleted_at) return;
    const editable = canEdit(m);
    const buttons: any[] = [];
    if (editable) {
      buttons.push({
        text: 'Редактировать',
        onPress: () => {
          setEditingId(m.id);
          setInput(m.body);
        },
      });
      buttons.push({
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await chatApi.deleteMessage(m.id);
          } catch {
            Alert.alert('Ошибка', 'Не удалось удалить');
          }
        },
      });
    }
    buttons.push({text: 'Отмена', style: 'cancel'});
    Alert.alert(
      'Сообщение',
      editable ? '' : 'Окно редактирования (5 мин) истекло',
      buttons,
    );
  };

  const renderItem = ({item}: {item: Message}) => {
    const mine = item.sender_id === myId;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onLongPress={() => onLongPress(item)}
        style={[styles.bubbleRow, mine ? styles.rowRight : styles.rowLeft]}>
        <View
          style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleTheirs,
            item.deleted_at && styles.bubbleDeleted,
          ]}>
          <Text style={mine ? styles.textMine : styles.textTheirs}>
            {item.deleted_at ? 'Сообщение удалено' : item.body}
          </Text>
          <View style={styles.metaRow}>
            {item.edited_at && !item.deleted_at && (
              <Text style={[styles.meta, mine && styles.metaMine]}>изм.</Text>
            )}
            <Text style={[styles.meta, mine && styles.metaMine]}>
              {formatTime(item.created_at)}
            </Text>
            {mine && !item.deleted_at && (
              <Text style={[styles.meta, styles.metaMine]}>
                {item.is_read ? ' ✓✓' : ' ✓'}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({animated: false})
        }
      />
      {editingId && (
        <View style={styles.editBar}>
          <Text style={styles.editLabel}>Редактирование</Text>
          <TouchableOpacity
            onPress={() => {
              setEditingId(null);
              setInput('');
            }}>
            <Text style={styles.editCancel}>отмена</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Сообщение"
          placeholderTextColor={COLORS.textSecondary}
          multiline
          maxLength={4000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!input.trim() || sending}>
          <Text style={styles.sendText}>{editingId ? '✓' : '➤'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  listContent: {padding: SPACING.sm, paddingBottom: SPACING.md},
  bubbleRow: {marginVertical: 2, flexDirection: 'row'},
  rowLeft: {justifyContent: 'flex-start'},
  rowRight: {justifyContent: 'flex-end'},
  bubble: {
    maxWidth: '78%',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
  },
  bubbleMine: {backgroundColor: COLORS.primary, borderBottomRightRadius: 4},
  bubbleTheirs: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bubbleDeleted: {opacity: 0.6},
  textMine: {color: COLORS.textLight, fontSize: FONT_SIZE.md},
  textTheirs: {color: COLORS.text, fontSize: FONT_SIZE.md},
  metaRow: {flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2},
  meta: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginLeft: 4},
  metaMine: {color: '#E0F2E1'},
  editBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: '#FFF8E1',
  },
  editLabel: {color: COLORS.text, fontSize: FONT_SIZE.sm},
  editCancel: {color: COLORS.error, fontSize: FONT_SIZE.sm},
  inputRow: {
    flexDirection: 'row',
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  sendBtnDisabled: {opacity: 0.4},
  sendText: {color: COLORS.textLight, fontSize: FONT_SIZE.lg},
});
