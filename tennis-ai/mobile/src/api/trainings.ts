import client from './client';
import {Training, TrainingCreate, TrainingListItem, TrainingParticipantStatus} from '../types/training';

export const trainingsApi = {
  list: () => client.get<TrainingListItem[]>('/trainings'),
  get: (id: string) => client.get<Training>(`/trainings/${id}`),
  create: (payload: TrainingCreate) => client.post<Training>('/trainings', payload),
  invite: (id: string, userId: string) =>
    client.post<Training>(`/trainings/${id}/invite`, {user_id: userId}),
  respond: (id: string, status: Exclude<TrainingParticipantStatus, 'invited'>) =>
    client.post<Training>(`/trainings/${id}/respond`, {status}),
  cancel: (id: string) => client.post<Training>(`/trainings/${id}/cancel`),
};
