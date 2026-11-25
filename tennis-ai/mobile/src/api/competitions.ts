import client from './client';
import {
  Competition,
  CompetitionCreate,
  CompetitionListItem,
  CompetitionGroup,
  GroupCreate,
} from '../types/competition';

export const competitionsApi = {
  list: () =>
    client.get<CompetitionListItem[]>('/competitions'),

  create: (payload: CompetitionCreate) =>
    client.post<Competition>('/competitions', payload),

  get: (id: string) =>
    client.get<Competition>(`/competitions/${id}`),

  addGroup: (id: string, payload: GroupCreate) =>
    client.post<CompetitionGroup>(`/competitions/${id}/groups`, payload),

  register: (id: string, groupId: string) =>
    client.post<CompetitionGroup>(`/competitions/${id}/register`, {group_id: groupId}),

  unregister: (id: string, groupId: string) =>
    client.delete(`/competitions/${id}/register/${groupId}`),

  inviteByFilter: (
    id: string,
    body: {group_id: string; age_min?: number; age_max?: number; stm_min?: number; stm_max?: number},
  ) => client.post<{matched: number; sent: number}>(`/competitions/${id}/invite-by-filter`, body),
};
