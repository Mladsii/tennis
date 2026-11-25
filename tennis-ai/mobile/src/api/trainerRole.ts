import client from './client';

export type TrainerStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface TrainerApplication {
  user_id: string;
  last_name: string;
  first_name: string;
  nickname: string;
  trainer_status: TrainerStatus;
  trainer_skills: string | null;
  trainer_education: string | null;
  trainer_achievements: string | null;
  trainer_individual: boolean;
  trainer_group: boolean;
  trainer_kids: boolean;
  trainer_disabled: boolean;
}

export interface TrainerApplyPayload {
  skills: string;
  education?: string | null;
  achievements?: string | null;
  individual: boolean;
  group: boolean;
  kids: boolean;
  disabled: boolean;
}

export const trainerRoleApi = {
  apply: (payload: TrainerApplyPayload) =>
    client.post<{trainer_status: TrainerStatus}>('/trainer-role/apply', payload),
  me: () => client.get<TrainerApplication>('/trainer-role/me'),
  list: () => client.get<TrainerApplication[]>('/trainer-role/applications'),
  approve: (userId: string) =>
    client.post<TrainerApplication>(`/trainer-role/${userId}/approve`),
  reject: (userId: string) =>
    client.post<TrainerApplication>(`/trainer-role/${userId}/reject`),
};
