import {UserPublic} from './user';

export type GameType = 'singles' | 'doubles' | 'mixed' | 'any';

export interface SearchRequest {
  id: string;
  author_id: string;
  author: UserPublic;
  game_type: GameType;
  stm_level: string | null;
  stm_min?: string | null;
  stm_max?: string | null;
  gender_filter?: string | null;
  court_booked: boolean;
  location_id: string | null;
  booking_id: string | null;
  // Computed by server: human-readable court/location info
  location_name: string | null;
  court_name: string | null;
  booking_date: string | null;      // YYYY-MM-DD
  booking_slot_start: string | null; // HH:MM
  booking_slot_end: string | null;   // HH:MM
  start_time: string;
  end_time: string;
  notes: string | null;
  is_active: boolean;
  max_players: number;
  confirmed_count: number;
  pending_count?: number;
  responses_count?: number;
  has_my_response?: boolean;
  my_response_status?: 'pending' | 'confirmed' | 'declined' | 'reset' | null;
  open_date?: boolean;
  only_preferred?: boolean;
  created_at: string;
  responses?: SearchResponseItem[];
}

export interface SearchResponseItem {
  id: string;
  search_request_id: string;
  responder_id: string;
  responder: UserPublic;
  status: 'pending' | 'confirmed' | 'declined' | 'reset';
  decline_reason: string | null;
  created_at: string;
}

export interface CreateSearchRequest {
  game_type: GameType;
  stm_level?: string;
  stm_min?: string;
  stm_max?: string;
  gender_filter?: string;
  court_booked: boolean;
  location_id?: string;
  booking_id?: string;   // UUID брони корта — заполняется когда court_booked=true
  start_time: string;
  end_time: string;
  notes?: string;
  only_preferred?: boolean;
  open_date?: boolean;
}
