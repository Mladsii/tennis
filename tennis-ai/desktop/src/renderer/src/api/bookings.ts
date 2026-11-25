import { api } from './client'

export interface LocationInfo {
  id: string
  name: string
  address: string
  city: string
  court_count: number
}

export interface SlotInfo {
  slot_start: string
  slot_end: string
  // free | mine | booked | locked | periodic | periodic_mine
  status: 'free' | 'booked' | 'mine' | 'locked' | 'periodic' | 'periodic_mine'
  booking_id: string | null
  player_id: string | null
  player_name: string | null
  player_nickname: string | null
  player_phone: string | null
  notes: string | null
  payment_status: string | null    // unpaid | cash | card | sbp
  is_periodic: boolean
  locked_until: string | null      // ISO datetime если слот заблокирован
}

export interface CourtGrid {
  court_id: string
  court_name: string
  sport: string
  is_singles_only: boolean
  price_per_slot: number | null
  slots: SlotInfo[]
}

export interface LocationGrid {
  location_id: string
  location_name: string
  date: string
  courts: CourtGrid[]
}

export interface BookingResponse {
  id: string
  court_id: string
  user_id: string | null
  player_name: string | null
  player_nickname: string | null
  player_phone: string | null
  date: string
  slot_start: string
  slot_end: string
  status: string
  notes: string | null
  payment_status: string
  is_periodic: boolean
  day_of_week: number | null
  recurring_group_id: string | null
}

export interface AdminBookingCreate {
  court_id: string
  date: string
  slot_starts: string[]
  user_id?: string
  notes?: string
  payment_status?: string          // unpaid | cash | card | sbp
  is_periodic?: boolean
  day_of_week?: number             // 0=Пн … 6=Вс
  valid_until?: string             // YYYY-MM-DD
}

export interface AdminBookingResponse {
  booked: BookingResponse[]
  failed: string[]
}

export interface SlotLockResponse {
  id: string
  court_id: string
  user_id: string
  date: string
  slot_start: string
  expires_at: string
}

export interface DayRevenue {
  date: string
  revenue: number
  bookings_count: number
  unique_visitors: number
  used_slots: number
  free_slots: number
  load_pct: number
}

export interface CourtReport {
  location_id: string
  location_name: string
  date_from: string
  date_to: string
  total_revenue: number
  total_bookings: number
  total_visitors: number
  avg_load_pct: number
  by_day: DayRevenue[]
}

export const bookingsApi = {
  async listLocations(): Promise<LocationInfo[]> {
    const { data } = await api.get<LocationInfo[]>('/bookings/locations')
    return data
  },

  async getGrid(locationId: string, date: string): Promise<LocationGrid> {
    const { data } = await api.get<LocationGrid>(`/bookings/grid/${locationId}`, {
      params: { date },
    })
    return data
  },

  /** Обычная бронь (мобилка / для себя) */
  async create(courtId: string, date: string, slotStart: string): Promise<BookingResponse> {
    const { data } = await api.post<BookingResponse>('/bookings', {
      court_id: courtId, date, slot_start: slotStart,
    })
    return data
  },

  /** Админская бронь: за игрока, диапазон слотов */
  async adminCreate(payload: AdminBookingCreate): Promise<AdminBookingResponse> {
    const { data } = await api.post<AdminBookingResponse>('/bookings/admin', payload)
    return data
  },

  /** Отменить бронь; cancel_series=true — вся серия периодической */
  async cancel(bookingId: string, cancelSeries = false): Promise<void> {
    await api.delete(`/bookings/${bookingId}`, { params: { cancel_series: cancelSeries } })
  },

  /** Брони конкретного игрока */
  async playerBookings(userId: string, upcomingOnly = true): Promise<BookingResponse[]> {
    const { data } = await api.get<BookingResponse[]>(`/bookings/player/${userId}`, {
      params: { upcoming_only: upcomingOnly },
    })
    return data
  },

  /** Заблокировать слот на 7 минут */
  async lockSlot(courtId: string, date: string, slotStart: string): Promise<SlotLockResponse> {
    const { data } = await api.post<SlotLockResponse>('/bookings/lock', {
      court_id: courtId, date, slot_start: slotStart,
    })
    return data
  },

  /** Снять блокировку слота досрочно */
  async unlockSlot(lockId: string): Promise<void> {
    await api.delete(`/bookings/lock/${lockId}`)
  },

  /** Отчёт по загруженности/выручке за период */
  async getReport(locationId: string, dateFrom: string, dateTo: string): Promise<CourtReport> {
    const { data } = await api.get<CourtReport>('/bookings/reports', {
      params: { location_id: locationId, date_from: dateFrom, date_to: dateTo },
    })
    return data
  },
}
