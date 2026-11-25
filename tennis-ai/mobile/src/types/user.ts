export interface User {
  id: string;
  last_name: string;
  first_name: string;
  patronymic: string | null;
  date_of_birth: string;
  gender: 'M' | 'F';
  photo_url: string | null;
  nickname: string;
  phone_primary: string;
  phone_secondary: string | null;
  address: string | null;
  city: string | null;
  years_playing: number;
  ntrp_level: string;
  stm_level: string;
  is_active_search: boolean;
  accept_other_requests: boolean;
  elo_rating: number;
  is_admin: boolean;
  is_premium: boolean;
  premium_expires_at: string | null;
  created_at: string;
}

export interface UserPublic {
  id: string;
  first_name: string;
  last_name: string;
  patronymic: string | null;
  gender: string;
  photo_url: string | null;
  nickname: string;
  years_playing: number;
  ntrp_level: string;
  stm_level: string;
  elo_rating: number;
}

export interface UserSettings {
  is_active_search: boolean;
  accept_other_requests: boolean;
  sound_on_search: boolean;
  sound_on_booking: boolean;
  sound_on_player_request: boolean;
  filter_gender: string | null;
  filter_stm_min: number | null;
  filter_stm_max: number | null;
  filter_game_type: string | null;
  filter_age_min: number | null;
  filter_age_max: number | null;
}

export interface RegisterData {
  last_name: string;
  first_name: string;
  patronymic?: string;
  date_of_birth: string;
  gender: 'M' | 'F';
  nickname: string;
  phone_primary: string;
  phone_secondary?: string;
  address?: string;
  city?: string;
  years_playing: number;
  ntrp_level: string;
  stm_level: string;
  password: string;
}
