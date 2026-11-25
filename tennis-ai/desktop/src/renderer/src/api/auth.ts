import { api } from './client'

export interface TokenResponse {
  access_token: string
  refresh_token: string
}

export async function login(phone: string, password: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/login', { phone, password })
  return data
}
