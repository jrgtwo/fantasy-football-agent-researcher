import { describe, expect, it } from 'vitest';
import { getPlayerStatsById, searchPlayers, topByPosition } from './query';
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

describe('topByPosition', () => {
  const players: Player[] = [
    { id: 'a', name: 'QB A', position: 'QB', team: 'KC', headshot: '', status: '' },
    { id: 'b', name: 'QB B', position: 'QB', team: 'BUF', headshot: '', status: '' },
    { id: 'c', name: 'RB C', position: 'RB', team: 'SF', headshot: '', status: '' },
    { id: 'd', name: 'QB D no stats', position: 'QB', team: 'NYJ', headshot: '', status: '' },
  ];
  const s = (playerId: string, ppr: number): PlayerStats =>
    ({ playerId, season: 2024, seasonType: 'REG', team: '', games: 1, passingYards: 0, passingTds: 0,
       interceptions: 0, carries: 0, rushingYards: 0, rushingTds: 0, receptions: 0, targets: 0,
       receivingYards: 0, receivingTds: 0, fantasyPoints: 0, fantasyPointsPpr: ppr }) as PlayerStats;
  const stats = [s('a', 100), s('b', 250), s('c', 300)];

  it('returns players at the position sorted by PPR desc', () => {
    const top = topByPosition(players, stats, 'QB', 5);
    expect(top.map((t) => t.player.id)).toEqual(['b', 'a']);
    expect(top[0]!.stats.fantasyPointsPpr).toBe(250);
  });

  it('respects the limit n', () => {
    expect(topByPosition(players, stats, 'QB', 1).map((t) => t.player.id)).toEqual(['b']);
  });

  it('is case-insensitive on position and excludes players with no stat line', () => {
    const top = topByPosition(players, stats, 'qb', 5);
    expect(top.map((t) => t.player.id)).toEqual(['b', 'a']); // 'd' has no stats → excluded
  });
});
