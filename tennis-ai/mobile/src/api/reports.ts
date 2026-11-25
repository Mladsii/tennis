import client from './client';

export interface ProgressReport {
  user_id: string;
  period_days: number;
  matches_total: number;
  wins: number;
  losses: number;
  win_rate: number;
  elo_now: number;
  elo_change: number;
}

export interface RankingItem {
  user_id: string;
  last_name: string;
  first_name: string;
  nickname: string;
  stm_level: string;
  elo_rating: number;
  rank: number;
}

export const reportsApi = {
  myProgress: (days = 7) =>
    client.get<ProgressReport>('/reports/me/progress', {params: {days}}),
  preferredRankings: () =>
    client.get<RankingItem[]>('/reports/preferred-rankings'),
};
