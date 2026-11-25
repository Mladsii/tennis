import api from './client';
import {RegisterData, User} from '../types/user';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export const authApi = {
  register: (data: RegisterData) =>
    api.post<User>('/auth/register', data),

  login: (phone: string, password: string) =>
    api.post<TokenResponse>('/auth/login', {phone, password}),

  refresh: (refreshToken: string) =>
    api.post<TokenResponse>('/auth/refresh', {refresh_token: refreshToken}),
};
