import client from './client';
import {BookingResponse, LocationGrid, LocationItem} from '../types/booking';

export const bookingsApi = {
  getLocations: () =>
    client.get<LocationItem[]>('/bookings/locations'),

  getGrid: (locationId: string, date: string, courtType?: string) =>
    client.get<LocationGrid>(`/bookings/grid/${locationId}`, {
      params: {date, ...(courtType && courtType !== 'all' ? {court_type: courtType} : {})},
    }),

  book: (courtId: string, date: string, slotStart: string) =>
    client.post('/bookings', {
      court_id: courtId,
      date,
      slot_start: slotStart,
    }),

  cancel: (bookingId: string) =>
    client.delete(`/bookings/${bookingId}`),

  getMine: (upcomingOnly = true) =>
    client.get<BookingResponse[]>('/bookings/mine', {params: {upcoming_only: upcomingOnly}}),
};
