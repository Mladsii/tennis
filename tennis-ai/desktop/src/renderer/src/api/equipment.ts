import { api } from './client'

export interface EquipmentItem {
  id: string
  location_id: string
  name: string
  equipment_type: 'racket' | 'balls' | 'basket' | 'other'
  quantity_total: number
  quantity_available: number
  price_per_hour: string | null
  is_active: boolean
  created_at: string
}

export interface EquipmentRental {
  id: string
  equipment: EquipmentItem
  user: { id: string; first_name: string; last_name: string; nickname: string } | null
  created_by: { id: string; first_name: string; last_name: string } | null
  booking_id: string | null
  quantity: number
  rented_at: string
  returned_at: string | null
  status: 'active' | 'returned'
  created_at: string
}

export const equipmentApi = {
  async list(params?: { location_id?: string; include_inactive?: boolean }): Promise<EquipmentItem[]> {
    const { data } = await api.get<EquipmentItem[]>('/equipment', { params })
    return data
  },
  async create(item: {
    location_id: string; name: string; equipment_type: string; quantity_total: number; price_per_hour?: number
  }): Promise<EquipmentItem> {
    const { data } = await api.post<EquipmentItem>('/equipment', item)
    return data
  },
  async update(id: string, update: Partial<{
    name: string; quantity_total: number; price_per_hour: number; is_active: boolean
  }>): Promise<EquipmentItem> {
    const { data } = await api.put<EquipmentItem>(`/equipment/${id}`, update)
    return data
  },
  async listRentals(params?: { status?: string; location_id?: string }): Promise<EquipmentRental[]> {
    const { data } = await api.get<EquipmentRental[]>('/equipment/rentals', { params })
    return data
  },
  async rent(rental: { equipment_id: string; user_id?: string; booking_id?: string; quantity?: number }): Promise<EquipmentRental> {
    const { data } = await api.post<EquipmentRental>('/equipment/rentals', rental)
    return data
  },
  async returnRental(rentalId: string): Promise<EquipmentRental> {
    const { data } = await api.post<EquipmentRental>(`/equipment/rentals/${rentalId}/return`)
    return data
  },
}
