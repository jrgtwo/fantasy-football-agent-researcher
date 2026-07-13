import { describe, it, expect, vi } from 'vitest';
import { resolveSelectPlayer } from './clientTools';
import type { Player, PlayerStats } from '../data/types';

const player = (over: Partial<Player> = {}): Player => ({
  id: 'p1',
  name: 'Josh Allen',
  position: 'QB',
  team: 'BUF',
  headshot: '',
  status: 'ACT',
  ...over,
});

const stats = (over: Partial<PlayerStats> = {}): PlayerStats => ({
  playerId: 'p1',
  season: 2025,
  seasonType: 'REG',
  team: 'BUF',
  games: 17,
  passingYards: 4200,
  passingTds: 32,
  interceptions: 10,
  carries: 100,
  rushingYards: 520,
  rushingTds: 12,
  receptions: 0,
  targets: 0,
  receivingYards: 0,
  receivingTds: 0,
  fantasyPoints: 300,
  fantasyPointsPpr: 320.5,
  ...over,
});

describe('resolveSelectPlayer', () => {
  it('resolves a name to the top match and a compact stat payload', async () => {
    const searchPlayers = vi.fn(async () => [player(), player({ id: 'p2', name: 'Josh Allen Jr.' })]);
    const getPlayerStats = vi.fn(async () => stats());

    const res = await resolveSelectPlayer({ name: 'Josh Allen' }, { searchPlayers, getPlayerStats });

    expect(searchPlayers).toHaveBeenCalledWith('Josh Allen');
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(res.player.id).toBe('p1'); // top match
    expect(getPlayerStats).toHaveBeenCalledWith('p1');
    // payload is what the agent sees — compact + grounded
    expect(res.payload).toMatchObject({
      player: { name: 'Josh Allen', position: 'QB', team: 'BUF' },
      season: 2025,
      stats: { fantasyPointsPPR: 320.5, passYds: 4200, passTds: 32 },
    });
  });

  it('errors when no player matches', async () => {
    const searchPlayers = vi.fn(async () => [] as Player[]);
    const getPlayerStats = vi.fn(async () => null);

    const res = await resolveSelectPlayer({ name: 'Nobody' }, { searchPlayers, getPlayerStats });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected error');
    expect(res.error).toMatch(/no player named "Nobody"/);
    expect(getPlayerStats).not.toHaveBeenCalled();
  });

  it('errors when the name argument is missing or blank', async () => {
    const searchPlayers = vi.fn(async () => [] as Player[]);
    const getPlayerStats = vi.fn(async () => null);

    const res = await resolveSelectPlayer({ name: '  ' }, { searchPlayers, getPlayerStats });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected error');
    expect(res.error).toMatch(/name/);
    expect(searchPlayers).not.toHaveBeenCalled();
  });
});
