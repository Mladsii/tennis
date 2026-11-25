import api from './client';
import {Location, PreferredLocation} from '../types/location';

export const locationsApi = {
  list: (city?: string) =>
    api.get<Location[]>('/locations', {params: city ? {city} : {}}),

  get: (id: string) => api.get<Location>(`/locations/${id}`),

  getPreferred: () =>
    api.get<PreferredLocation[]>('/users/me/preferred-locations'),

  addPreferred: (locationId: string, useInSearch = true) =>
    api.post<PreferredLocation>('/users/me/preferred-locations', {
      location_id: locationId,
      use_in_search: useInSearch,
    }),

  updatePreferred: (prefId: string, useInSearch: boolean) =>
    api.put<PreferredLocation>(`/users/me/preferred-locations/${prefId}`, {
      use_in_search: useInSearch,
    }),

  removePreferred: (prefId: string) =>
    api.delete(`/users/me/preferred-locations/${prefId}`),
};
