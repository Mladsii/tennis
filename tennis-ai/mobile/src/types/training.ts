import {OrganizerBrief as UserBrief} from './competition';

export type TrainingScheduleType = 'one_time' | 'weekly';
export type TrainingParticipantStatus = 'invited' | 'confirmed' | 'declined' | 'cancelled';

export interface TrainingParticipant {
  id: string;
  user: UserBrief;
  status: TrainingParticipantStatus;
}

export interface Training {
  id: string;
  organizer: UserBrief;
  organizer_id: string;
  trainer: UserBrief | null;
  title: string;
  description: string | null;
  location: string | null;
  schedule_type: TrainingScheduleType;
  start_time: string;
  end_time: string;
  weeks_count: number | null;
  max_participants: number | null;
  status: 'active' | 'cancelled' | 'finished';
  participants: TrainingParticipant[];
}

export interface TrainingListItem {
  id: string;
  title: string;
  location: string | null;
  schedule_type: TrainingScheduleType;
  start_time: string;
  end_time: string;
  organizer: UserBrief;
  confirmed_count: number;
}

export interface TrainingCreate {
  title: string;
  description?: string | null;
  location?: string | null;
  schedule_type: TrainingScheduleType;
  start_time: string;
  end_time: string;
  weeks_count?: number | null;
  max_participants?: number | null;
  trainer_id?: string | null;
  invite_user_ids: string[];
}
