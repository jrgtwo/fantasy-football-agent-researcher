import type { Player, PlayerStats } from '../data/types';

// Calls to the app's own stats API (proxied under /api → the sidecar's http server). Deterministic
// facts for the card — separate from the harness WebSocket.

export async function searchPlayers(q: string): Promise<Player[]> {
  const res = await fetch(`/api/players?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return (await res.json()) as Player[];
}

export async function getPlayerStats(id: string): Promise<PlayerStats | null> {
  const res = await fetch(`/api/players/${encodeURIComponent(id)}/stats`);
  if (!res.ok) return null;
  return (await res.json()) as PlayerStats;
}

export async function getRankingCandidates(
  position: string,
  n = 8,
): Promise<{ player: Player; stats: PlayerStats }[]> {
  const res = await fetch(`/api/rankings/candidates?position=${encodeURIComponent(position)}&n=${n}`);
  if (!res.ok) return [];
  return (await res.json()) as { player: Player; stats: PlayerStats }[];
}
