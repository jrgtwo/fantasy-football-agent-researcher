import { describe, expect, it } from 'vitest';
import { getPlayerStatsById, searchPlayers } from './query';
import type { Player, PlayerStats } from './types';

const PLAYERS: Player[] = [
  { id: '1', name: 'Bijan Robinson', position: 'RB', team: 'ATL', headshot: '', status: 'ACT' },
  { id: '2', name: 'Breece Hall', position: 'RB', team: 'NYJ', headshot: '', status: 'ACT' },
  { id: '3', name: 'Puka Nacua', position: 'WR', team: 'LA', headshot: '', status: 'ACT' },
];

const STATS: PlayerStats[] = [
  {
    playerId: '2',
    season: 2025,
    seasonType: 'REG',
    team: 'NYJ',
    games: 17,
    passingYards: 0,
    passingTds: 0,
    interceptions: 0,
    carries: 223,
    rushingYards: 994,
    rushingTds: 5,
    receptions: 57,
    targets: 76,
    receivingYards: 483,
    receivingTds: 3,
    fantasyPoints: 180.7,
    fantasyPointsPpr: 237.7,
  },
];

describe('searchPlayers', () => {
  it('matches a name substring case-insensitively', () => {
    expect(searchPlayers(PLAYERS, 'rob').map((p) => p.name)).toEqual(['Bijan Robinson']);
    expect(searchPlayers(PLAYERS, 'HALL').map((p) => p.name)).toEqual(['Breece Hall']);
  });

  it('returns [] for a non-match', () => {
    expect(searchPlayers(PLAYERS, 'zzz')).toEqual([]);
  });

  it('returns [] for an empty/whitespace query', () => {
    expect(searchPlayers(PLAYERS, '   ')).toEqual([]);
  });

  it('sorts matches by name and respects the limit', () => {
    // "a" appears in all three names; alphabetical order caps at the limit.
    expect(searchPlayers(PLAYERS, 'a', 2).map((p) => p.name)).toEqual(['Bijan Robinson', 'Breece Hall']);
  });
});

describe('getPlayerStatsById', () => {
  it('returns the stats for a known player id', () => {
    expect(getPlayerStatsById(STATS, '2')?.fantasyPointsPpr).toBe(237.7);
  });

  it('returns undefined for an unknown id', () => {
    expect(getPlayerStatsById(STATS, '999')).toBeUndefined();
  });
});
