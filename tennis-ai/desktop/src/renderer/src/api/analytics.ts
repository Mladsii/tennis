import { api } from './client'

export interface HeatmapCell {
  dow: number   // 0=вс … 6=сб
  hour: number
  count: number
}

export interface HeatmapResponse {
  location_id: string
  date_from: string
  date_to: string
  cells: HeatmapCell[]
  max_count: number
}

export interface RevenueDayItem {
  day: string
  cash: number
  card: number
  sbp: number
  subscription: number
  total: number
}

export interface RevenueResponse {
  date_from: string
  date_to: string
  items: RevenueDayItem[]
  totals: RevenueDayItem
}

export interface TrainerItem {
  trainer_id: string
  first_name: string
  last_name: string
  nickname: string
  sessions: number
  hours: number
}

export interface TrainersResponse {
  date_from: string
  date_to: string
  items: TrainerItem[]
}

export const analyticsApi = {
  async heatmap(locationId: string, dateFrom?: string, dateTo?: string): Promise<HeatmapResponse> {
    const { data } = await api.get<HeatmapResponse>('/analytics/court-heatmap', {
      params: { location_id: locationId, date_from: dateFrom, date_to: dateTo },
    })
    return data
  },

  async revenue(dateFrom?: string, dateTo?: string): Promise<RevenueResponse> {
    const { data } = await api.get<RevenueResponse>('/analytics/revenue', {
      params: { date_from: dateFrom, date_to: dateTo },
    })
    return data
  },

  async trainers(dateFrom?: string, dateTo?: string): Promise<TrainersResponse> {
    const { data } = await api.get<TrainersResponse>('/analytics/trainers', {
      params: { date_from: dateFrom, date_to: dateTo },
    })
    return data
  },

  async exportBookings(dateFrom: string, dateTo: string, locationId?: string): Promise<void> {
    const params: Record<string, string> = { date_from: dateFrom, date_to: dateTo }
    if (locationId) params.location_id = locationId
    const { data } = await api.get('/analytics/export/bookings', { params, responseType: 'blob' })
    _downloadBlob(data, `bookings_${dateFrom}_${dateTo}.xlsx`)
  },

  async exportRevenue(dateFrom: string, dateTo: string): Promise<void> {
    const { data } = await api.get('/analytics/export/revenue', {
      params: { date_from: dateFrom, date_to: dateTo },
      responseType: 'blob',
    })
    _downloadBlob(data, `revenue_${dateFrom}_${dateTo}.xlsx`)
  },
}

function _downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
