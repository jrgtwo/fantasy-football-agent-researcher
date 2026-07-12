import { getPlayerStatsById, searchPlayers } from './query';
import { loadSnapshot } from './snapshot';
import type { Player, PlayerStats } from './types';

// Binds the (tested, pure) queries to a loaded snapshot. The sidecar creates one of these at startup
// and the app HTTP API serves from it.

export interface StatsStore {
  season: number;
  search(query: string, limit?: number): Player[];
  stats(playerId: string): PlayerStats | undefined;
}

export function createStatsStore(path?: string): StatsStore {
  const snap = loadSnapshot(path);
  return {
    season: snap.season,
    search: (query, limit) => searchPlayers(snap.players, query, limit),
    stats: (playerId) => getPlayerStatsById(snap.stats, playerId),
  };
}
