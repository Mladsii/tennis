import { api } from './client'

export interface QueueUser {
  id: string; first_name: string; last_name: string; nickname: string
}

export interface QueueEntry {
  id: string
  court_id: string
  location_id?: string | null
  any_court?: boolean
  user: QueueUser
  date: string
  slot_start: string
  slot_end?: string | null
  min_duration?: number
  accept_partial?: boolean
  status: string
  created_at: string
  court_name?: string | null
  location_name?: string | null
}

export const queueApi = {
  async list(params?: { court_id?: string; date?: string }): Promise<QueueEntry[]> {
    const { data } = await api.get<QueueEntry[]>('/queue', { params })
    return data
  },
  async add(entry: {
    court_id: string
    date: string
    slot_start: string
    slot_end?: string
    min_duration?: number
    accept_partial?: boolean
    user_id: string
    any_court?: boolean
  }): Promise<QueueEntry> {
    const { data } = await api.post<QueueEntry>('/queue', entry)
    return data
  },
  async notify(entryId: string): Promise<QueueEntry> {
    const { data } = await api.put<QueueEntry>(`/queue/${entryId}/notify`)
    return data
  },
  async remove(entryId: string): Promise<void> {
    await api.delete(`/queue/${entryId}`)
  },
}
