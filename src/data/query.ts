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

// Seed a ranking's candidate pool: players at a position that have a stat line, best-first by PPR.
export function topByPosition(
  players: Player[],
  stats: PlayerStats[],
  position: string,
  n: number,
): { player: Player; stats: PlayerStats }[] {
  const pos = position.trim().toLowerCase();
  const byId = new Map(stats.map((s) => [s.playerId, s]));
  return players
    .filter((p) => p.position.toLowerCase() === pos)
    .map((player) => ({ player, stats: byId.get(player.id) }))
    .filter((x): x is { player: Player; stats: PlayerStats } => x.stats !== undefined)
    .sort((a, b) => b.stats.fantasyPointsPpr - a.stats.fantasyPointsPpr)
    .slice(0, n);
}
