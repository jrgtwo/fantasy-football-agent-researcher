import { describe, expect, it } from 'vitest';
import { getPlayerStatsById, searchPlayers } from '../data/query';
import type { StatsStore } from '../data/store';
import type { Player, PlayerStats } from '../data/types';
import { handleApiRequest } from './appApi';

const players: Player[] = [
  { id: '1', name: 'Patrick Mahomes', position: 'QB', team: 'KC', headshot: 'h', status: 'ACT' },
  { id: '2', name: 'Josh Allen', position: 'QB', team: 'BUF', headshot: 'h', status: 'ACT' },
];
const stats: PlayerStats[] = [
  {
    playerId: '1',
    season: 2025,
    seasonType: 'REG',
    team: 'KC',
    games: 14,
    passingYards: 3587,
    passingTds: 22,
    interceptions: 0,
    carries: 30,
    rushingYards: 200,
    rushingTds: 1,
    receptions: 0,
    targets: 0,
    receivingYards: 0,
    receivingTds: 0,
    fantasyPoints: 250,
    fantasyPointsPpr: 285.68,
  },
  {
    playerId: '2',
    season: 2025,
    seasonType: 'REG',
    team: 'BUF',
    games: 14,
    passingYards: 3300,
    passingTds: 25,
    interceptions: 5,
    carries: 90,
    rushingYards: 500,
    rushingTds: 8,
    receptions: 0,
    targets: 0,
    receivingYards: 0,
    receivingTds: 0,
    fantasyPoints: 300,
    fantasyPointsPpr: 330.5,
  },
];
// A real (minimal) store over the real query functions — not a behavior mock.
const store: StatsStore = {
  season: 2025,
  search: (q, limit) => searchPlayers(players, q, limit),
  stats: (id) => getPlayerStatsById(stats, id),
  allPlayers: () => players,
  allStats: () => stats,
};

describe('handleApiRequest', () => {
  it('GET /players?q= returns matching players', () => {
    const res = handleApiRequest('GET', '/players?q=mah', store);
    expect(res.status).toBe(200);
    expect((res.body as Player[]).map((p) => p.name)).toEqual(['Patrick Mahomes']);
  });

  it('handles the /api proxy prefix', () => {
    const res = handleApiRequest('GET', '/api/players?q=mah', store);
    expect(res.status).toBe(200);
    expect(res.body as Player[]).toHaveLength(1);
  });

  it('GET /players/:id/stats returns stats for a known player', () => {
    const res = handleApiRequest('GET', '/players/1/stats', store);
    expect(res.status).toBe(200);
    expect((res.body as PlayerStats).fantasyPointsPpr).toBe(285.68);
  });

  it('GET /players/:id/stats 404s for an unknown player', () => {
    expect(handleApiRequest('GET', '/players/999/stats', store).status).toBe(404);
  });

  it('404s an unknown path', () => {
    expect(handleApiRequest('GET', '/nope', store).status).toBe(404);
  });

  it('405s a non-GET method', () => {
    expect(handleApiRequest('POST', '/players', store).status).toBe(405);
  });
});

describe('GET /rankings/candidates', () => {
  it('returns seeded candidates for a position', () => {
    const res = handleApiRequest('GET', '/rankings/candidates?position=QB&n=2', store);
    expect(res.status).toBe(200);
    const body = res.body as { player: { position: string } }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(2);
    for (const c of body) expect(c.player.position).toBe('QB');
  });

  it('400s when position is missing', () => {
    expect(handleApiRequest('GET', '/rankings/candidates', store).status).toBe(400);
  });

  it('defaults n to 8 when the param is missing or empty', () => {
    const r1 = handleApiRequest('GET', '/rankings/candidates?position=QB', store);
    const r2 = handleApiRequest('GET', '/rankings/candidates?position=QB&n=', store);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect((r1.body as unknown[]).length).toBe((r2.body as unknown[]).length);
    expect((r1.body as unknown[]).length).toBeLessThanOrEqual(8);
  });

  it('clamps n to the 1..12 range', () => {
    const low = handleApiRequest('GET', '/rankings/candidates?position=QB&n=0', store);
    const high = handleApiRequest('GET', '/rankings/candidates?position=QB&n=999', store);
    expect(low.status).toBe(200);
    expect(high.status).toBe(200);
    expect((low.body as unknown[]).length).toBeLessThanOrEqual(1);
    expect((high.body as unknown[]).length).toBeLessThanOrEqual(12);
  });
});
