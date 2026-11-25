import client from './client';
import {GameScore, GameScoreCreate} from '../types/gameScore';

export const gameScoresApi = {
  list: () => client.get<GameScore[]>('/game-scores'),
  get: (id: string) => client.get<GameScore>(`/game-scores/${id}`),
  create: (payload: GameScoreCreate) => client.post<GameScore>('/game-scores', payload),
  confirm: (id: string) => client.post<GameScore>(`/game-scores/${id}/confirm`),
  decline: (id: string, reason?: string) =>
    client.post<GameScore>(`/game-scores/${id}/decline`, {reason}),
  delete: (id: string) => client.delete(`/game-scores/${id}`),
};
