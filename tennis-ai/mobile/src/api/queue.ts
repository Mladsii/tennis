import client from './client';
import {QueueEntry} from '../types/queue';

export const queueApi = {
  getMine: () =>
    client.get<QueueEntry[]>('/queue/mine'),

  join: (
    courtId: string,
    date: string,
    slotStart: string,
    opts?: {
      slotEnd?: string;
      minDuration?: number;
      acceptPartial?: boolean;
      anyCourt?: boolean;
    },
  ) =>
    client.post<QueueEntry>('/queue', {
      court_id: courtId,
      date,
      slot_start: slotStart,
      slot_end: opts?.slotEnd,
      min_duration: opts?.minDuration ?? 60,
      accept_partial: opts?.acceptPartial ?? false,
      any_court: opts?.anyCourt ?? false,
    }),

  leave: (entryId: string) =>
    client.delete(`/queue/${entryId}`),
};
