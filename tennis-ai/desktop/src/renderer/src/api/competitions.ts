import { api } from './client'

export interface CompUser {
  id: string
  first_name: string
  last_name: string
  nickname: string
}

export interface CompetitionListItem {
  id: string
  name: string
  organizer: CompUser
  start_date: string
  end_date: string
  location: string | null
  status: string
  participant_count: number
}

export const competitionsApi = {
  async list(): Promise<CompetitionListItem[]> {
    const { data } = await api.get<CompetitionListItem[]>('/competitions')
    return data
  },
}
