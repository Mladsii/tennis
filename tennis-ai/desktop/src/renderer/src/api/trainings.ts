import { api } from './client'

export interface TrainingUser {
  id: string
  first_name: string
  last_name: string
  nickname: string
  ntrp_level: string
  elo_rating: number
}

export interface TrainingListItem {
  id: string
  title: string
  location: string | null
  schedule_type: 'one_time' | 'weekly'
  start_time: string
  end_time: string
  organizer: TrainingUser
  confirmed_count: number
}

export interface TrainingParticipant {
  id: string
  user: TrainingUser
  status: 'invited' | 'confirmed' | 'declined' | 'cancelled'
}

export interface TrainingDetail extends TrainingListItem {
  description: string | null
  weeks_count: number | null
  max_participants: number | null
  status: string
  trainer: TrainingUser | null
  participants: TrainingParticipant[]
  organizer_id: string
}

export const trainingsApi = {
  async list(): Promise<TrainingListItem[]> {
    const { data } = await api.get<TrainingListItem[]>('/trainings')
    return data
  },

  async get(id: string): Promise<TrainingDetail> {
    const { data } = await api.get<TrainingDetail>(`/trainings/${id}`)
    return data
  },
}
