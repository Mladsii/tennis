import {UserPublic} from './user';

export interface QueueEntry {
  id: string;
  court_id: string;
  location_id?: string | null;
  any_court?: boolean;
  user: UserPublic;
  date: string;       // YYYY-MM-DD
  slot_start: string; // HH:MM
  slot_end?: string | null; // HH:MM — конец желаемого интервала
  min_duration?: number;    // минимальная длительность игры, минуты
  accept_partial?: boolean;
  status: 'waiting' | 'notified' | 'booked' | 'cancelled';
  created_at: string;
  court_name?: string | null;
  location_name?: string | null;
}
