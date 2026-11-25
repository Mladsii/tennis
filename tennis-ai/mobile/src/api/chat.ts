import api from './client';
import {Conversation, Message} from '../types/chat';

export const chatApi = {
  listConversations: () =>
    api.get<Conversation[]>('/chat/conversations'),

  openConversation: (peerId: string) =>
    api.post<Conversation>('/chat/conversations', {peer_id: peerId}),

  getMessages: (conversationId: string, before?: string, limit = 50) =>
    api.get<Message[]>(`/chat/conversations/${conversationId}/messages`, {
      params: {before, limit},
    }),

  sendMessage: (conversationId: string, body: string) =>
    api.post<Message>(`/chat/conversations/${conversationId}/messages`, {body}),

  markRead: (conversationId: string) =>
    api.put(`/chat/conversations/${conversationId}/read`),

  editMessage: (messageId: string, body: string) =>
    api.put<Message>(`/chat/messages/${messageId}`, {body}),

  deleteMessage: (messageId: string) =>
    api.delete(`/chat/messages/${messageId}`),

  unreadCount: () => api.get<{count: number}>('/chat/unread-count'),
};
