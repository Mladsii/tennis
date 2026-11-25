import { api } from './client'

export interface PlayerPublic {
  id: string
  first_name: string
  last_name: string
  patronymic: string | null
  gender: string
  photo_url: string | null
  nickname: string
  years_playing: number
  ntrp_level: string
  stm_level: string
  elo_rating: number
}

export interface PlayerFull extends PlayerPublic {
  phone_primary: string
  phone_secondary: string | null
  city: string | null
  address: string | null
  is_premium: boolean
  is_admin: boolean
  is_active_search: boolean
  created_at: string
}

export const playersApi = {
  async search(params: { phone?: string; nickname?: string }): Promise<PlayerPublic[]> {
    const { data } = await api.get<PlayerPublic[]>('/users/search', { params })
    return data
  },

  async getMe(): Promise<PlayerFull> {
    const { data } = await api.get<PlayerFull>('/users/me')
    return data
  },

  async getById(id: string): Promise<PlayerPublic> {
    const { data } = await api.get<PlayerPublic>(`/users/${id}`)
    return data
  },
}
