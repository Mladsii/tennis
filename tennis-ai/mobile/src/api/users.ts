import api from './client';
import {User, UserPublic, UserSettings} from '../types/user';

export const usersApi = {
  getMe: () => api.get<User>('/users/me'),

  updateMe: (data: Partial<User>) => api.put<User>('/users/me', data),

  getSettings: () => api.get<UserSettings>('/users/settings'),

  updateSettings: (data: Partial<UserSettings>) =>
    api.put<UserSettings>('/users/settings', data),

  searchByPhone: (phone: string) =>
    api.get<UserPublic[]>('/users/search', {params: {phone}}),

  searchByNickname: (nickname: string) =>
    api.get<UserPublic[]>('/users/search', {params: {nickname}}),

  getUser: (userId: string) => api.get<UserPublic>(`/users/${userId}`),
};
