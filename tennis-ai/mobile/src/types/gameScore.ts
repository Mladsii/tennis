import {OrganizerBrief as UserBrief} from './competition';

export type PointValue = '0' | '15' | '30' | '40' | 'Ad';

export interface GameScore {
  id: string;
  creator: UserBrief;
  opponent: UserBrief;
  server: UserBrief;
  played_at: string;
  creator_points: PointValue;
  opponent_points: PointValue;
  notes: string | null;
  status: 'pending' | 'confirmed' | 'declined';
  decline_reason: string | null;
  confirmed_at: string | null;
  creator_id: string;
  opponent_id: string;
  server_id: string;
}

export interface GameScoreCreate {
  opponent_id: string;
  server_id: string;
  played_at: string;
  creator_points: PointValue;
  opponent_points: PointValue;
  notes?: string | null;
}
