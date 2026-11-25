import api from './client';
import {CreateSearchRequest, SearchRequest, SearchResponseItem} from '../types/search';

export const searchApi = {
  create: (data: CreateSearchRequest) =>
    api.post<SearchRequest>('/search-requests', data),

  getMine: () => api.get<SearchRequest[]>('/search-requests/mine'),

  getAvailable: () => api.get<SearchRequest[]>('/search-requests/available'),

  get: (id: string) => api.get<SearchRequest>(`/search-requests/${id}`),

  update: (id: string, data: Partial<CreateSearchRequest>) =>
    api.put<SearchRequest>(`/search-requests/${id}`, data),

  deactivate: (id: string) => api.delete(`/search-requests/${id}`),

  respond: (searchId: string) =>
    api.post<SearchResponseItem>(`/search-requests/${searchId}/respond`),

  confirm: (searchId: string, responseId: string) =>
    api.put<SearchResponseItem>(
      `/search-requests/${searchId}/responses/${responseId}/confirm`,
    ),

  decline: (searchId: string, responseId: string, reason?: string) =>
    api.put<SearchResponseItem>(
      `/search-requests/${searchId}/responses/${responseId}/decline`,
      {decline_reason: reason || null},
    ),

  reset: (searchId: string, responseId: string) =>
    api.put<SearchResponseItem>(
      `/search-requests/${searchId}/responses/${responseId}/reset`,
    ),
};
