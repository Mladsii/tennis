import { api } from './client'

export interface LocationBrief {
  id: string
  name: string
  address: string
  city: string
}

export interface Court {
  id: string
  location_id: string
  name: string
  sport: 'tennis' | 'padel'
  is_singles_only: boolean
  is_doubles_or_singles: boolean
  court_type: 'indoor' | 'outdoor'
  surface_type: string
  photo_url: string | null
  is_active: boolean
}

export interface CourtCreate {
  name: string
  sport: 'tennis' | 'padel'
  court_type: 'indoor' | 'outdoor'
  surface_type: string
  is_singles_only?: boolean
  is_doubles_or_singles?: boolean
}

export interface LocationCreate {
  name: string
  address: string
  city: string
  description?: string
}

export const courtsApi = {
  async listLocations(): Promise<LocationBrief[]> {
    const { data } = await api.get<LocationBrief[]>('/locations')
    return data
  },

  async createLocation(loc: LocationCreate): Promise<LocationBrief> {
    const { data } = await api.post<LocationBrief>('/locations', loc)
    return data
  },

  async listCourts(locationId: string): Promise<Court[]> {
    const { data } = await api.get<Court[]>(`/locations/${locationId}/courts`)
    return data
  },

  async createCourt(locationId: string, court: CourtCreate): Promise<Court> {
    const { data } = await api.post<Court>(`/locations/${locationId}/courts`, court)
    return data
  },

  async updateCourt(
    locationId: string,
    courtId: string,
    update: Partial<Pick<Court, 'name' | 'is_active' | 'surface_type' | 'court_type' | 'sport'>>,
  ): Promise<Court> {
    const { data } = await api.put<Court>(
      `/locations/${locationId}/courts/${courtId}`,
      update,
    )
    return data
  },
}
