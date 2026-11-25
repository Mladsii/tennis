import api from './client';
import {
  EloPoint,
  MatchSet,
  MatchSetCreatePayload,
  MyMatchStats,
  PlayerRanking,
} from '../types/match';

export const matchesApi = {
  create: (data: MatchSetCreatePayload) =>
    api.post<MatchSet>('/matches/sets', data),

  list: (params?: {
    status?: 'pending' | 'confirmed' | 'declined';
    role?: 'creator' | 'opponent';
  }) => api.get<MatchSet[]>('/matches/sets/mine', {params}),

  getStats: () => api.get<MyMatchStats>('/matches/sets/stats'),

  get: (id: string) => api.get<MatchSet>(`/matches/sets/${id}`),

  confirm: (id: string) => api.post<MatchSet>(`/matches/sets/${id}/confirm`),

  decline: (id: string, declineReason?: string) =>
    api.post<MatchSet>(`/matches/sets/${id}/decline`, {
      decline_reason: declineReason,
    }),

  delete: (id: string) => api.delete(`/matches/sets/${id}`),

  preferredRanking: () =>
    api.get<PlayerRanking[]>('/matches/rankings/preferred'),

  eloHistory: (limit = 30) =>
    api.get<EloPoint[]>('/matches/elo-history', {params: {limit}}),
};
