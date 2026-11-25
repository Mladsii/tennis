import api from './client';
import {CourtTransfer, CourtTransferDetail, CourtTransferResponseItem, Notification, PlayerRequest, PreferredPlayer} from '../types/feed';

export const feedApi = {
  getFeed: (skip = 0, limit = 50) =>
    api.get<Notification[]>('/feed', {params: {skip, limit}}),

  getUnreadCount: () =>
    api.get<{count: number}>('/feed/unread-count'),

  markRead: (notificationId: string) =>
    api.put<Notification>(`/feed/${notificationId}/read`),

  markAllRead: () => api.put('/feed/read-all'),
};

export const courtTransferApi = {
  create: (data: {
    location_id: string;
    start_time: string;
    end_time: string;
    is_paid: boolean;
    notes?: string;
  }) => api.post<CourtTransfer>('/court-transfers', data),

  getMine: () => api.get<CourtTransfer[]>('/court-transfers/mine'),

  getAvailable: () => api.get<CourtTransfer[]>('/court-transfers/available'),

  get: (id: string) => api.get<CourtTransferDetail>(`/court-transfers/${id}`),

  respond: (ctId: string) =>
    api.post<CourtTransferResponseItem>(`/court-transfers/${ctId}/respond`),

  confirm: (ctId: string, respId: string) =>
    api.put<CourtTransferResponseItem>(`/court-transfers/${ctId}/responses/${respId}/confirm`),

  decline: (ctId: string, respId: string, declineReason?: string) =>
    api.put<CourtTransferResponseItem>(`/court-transfers/${ctId}/responses/${respId}/decline`, {
      decline_reason: declineReason,
    }),
};

export const playerRequestApi = {
  create: (phoneOrUserId: string) => {
    // If it looks like a UUID — send as target_user_id; otherwise as target_phone
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(phoneOrUserId);
    return api.post<PlayerRequest>('/player-requests', isUuid
      ? {target_user_id: phoneOrUserId}
      : {target_phone: phoneOrUserId});
  },

  getOutgoing: () => api.get<PlayerRequest[]>('/player-requests/outgoing'),

  getIncoming: () => api.get<PlayerRequest[]>('/player-requests/incoming'),

  accept: (id: string) =>
    api.put<PlayerRequest>(`/player-requests/${id}/accept`),

  decline: (id: string) =>
    api.put<PlayerRequest>(`/player-requests/${id}/decline`),
};

export const preferredPlayersApi = {
  list: () => api.get<PreferredPlayer[]>('/users/me/preferred-players'),

  update: (id: string, isActive: boolean) =>
    api.put<PreferredPlayer>(`/users/me/preferred-players/${id}`, {
      is_active: isActive,
    }),

  remove: (id: string) => api.delete(`/users/me/preferred-players/${id}`),

  // Добавить по user_id (из QR-кода)
  addById: (userId: string) =>
    api.post('/users/me/preferred-players/by-id', {user_id: userId}),
};
