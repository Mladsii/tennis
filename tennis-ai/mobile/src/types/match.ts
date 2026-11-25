import {UserPublic} from './user';

export type MatchStatus = 'pending' | 'confirmed' | 'declined';

export interface MatchSet {
  id: string;
  creator_id: string;
  opponent_id: string;
  creator: UserPublic;
  opponent: UserPublic;
  played_at: string;
  creator_games: number;
  opponent_games: number;
  creator_tiebreak: number | null;
  opponent_tiebreak: number | null;
  notes: string | null;
  photo_url: string | null;
  status: MatchStatus;
  decline_reason: string | null;
  confirmed_at: string | null;
  creator_elo_before: number | null;
  opponent_elo_before: number | null;
  creator_elo_change: number | null;
  opponent_elo_change: number | null;
  created_at: string;
}

export interface MatchSetCreatePayload {
  opponent_id: string;
  played_at: string;
  creator_games: number;
  opponent_games: number;
  creator_tiebreak?: number | null;
  opponent_tiebreak?: number | null;
  notes?: string | null;
  photo_url?: string | null;
}

export interface PlayerRanking {
  user: UserPublic;
  elo_rating: number;
  wins: number;
  losses: number;
}

export interface MyMatchStats {
  wins: number;
  losses: number;
  pending_incoming: number;
  pending_outgoing: number;
  elo_rating: number;
}

export interface EloPoint {
  date: string;  // YYYY-MM-DD
  elo: number;
}
