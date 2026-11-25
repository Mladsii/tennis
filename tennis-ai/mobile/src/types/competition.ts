export interface OrganizerBrief {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string;
  stm_level: string;
  elo_rating: number;
}

export interface ParticipantBrief {
  id: string;
  status: 'registered' | 'cancelled';
  user: OrganizerBrief;
}

export interface CompetitionGroup {
  id: string;
  name: string;
  age_from: number | null;
  age_to: number | null;
  stm_from: number | null;
  stm_to: number | null;
  max_participants: number | null;
  participants: ParticipantBrief[];
}

export interface CompetitionListItem {
  id: string;
  name: string;
  organizer: OrganizerBrief;
  start_date: string;
  end_date: string;
  location: string | null;
  status: string;
  participant_count: number;
}

export interface Competition {
  id: string;
  name: string;
  description: string | null;
  organizer: OrganizerBrief;
  start_date: string;
  end_date: string;
  location: string | null;
  status: string;
  groups: CompetitionGroup[];
}

export interface GroupCreate {
  name: string;
  age_from?: number | null;
  age_to?: number | null;
  stm_from?: number | null;
  stm_to?: number | null;
  max_participants?: number | null;
}

export interface CompetitionCreate {
  name: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  location?: string | null;
  groups: GroupCreate[];
}
