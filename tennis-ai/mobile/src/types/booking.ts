export type SlotStatus = 'free' | 'mine' | 'booked';

export interface SlotInfo {
  slot_start: string;  // "08:00"
  slot_end: string;    // "08:30"
  status: SlotStatus;
  booking_id?: string | null;
  // populated for admin or owner
  player_id?: string | null;
  player_name?: string | null;
  player_nickname?: string | null;
  player_phone?: string | null;
  notes?: string | null;
}

export interface CourtGrid {
  court_id: string;
  court_name: string;
  sport?: 'tennis' | 'padel';
  is_singles_only?: boolean;
  price_per_slot?: number | null;
  slots: SlotInfo[];
}

export interface LocationGrid {
  location_id: string;
  location_name: string;
  date: string;
  courts: CourtGrid[];
}

export interface LocationItem {
  id: string;
  name: string;
  address: string;
  city: string;
  court_count: number;
}

export interface BookingResponse {
  id: string;
  court_id: string;
  user_id: string;
  date: string;             // YYYY-MM-DD
  slot_start: string;       // HH:MM
  slot_end: string;         // HH:MM
  status: string;
  court_name?: string;      // populated by /bookings/mine
  location_name?: string;   // populated by /bookings/mine
  location_id?: string;     // populated by /bookings/mine
  created_at: string;
}
