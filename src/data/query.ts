import type { Player, PlayerStats } from './types';

// Pure queries over the in-memory snapshot. Kept small and dependency-free — the store binds these
// to the loaded data and the HTTP API exposes them.

export function searchPlayers(players: Player[], query: string, limit = 20): Player[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return players
    .filter((p) => p.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function getPlayerStatsById(stats: PlayerStats[], id: string): PlayerStats | undefined {
  return stats.find((s) => s.playerId === id);
}
