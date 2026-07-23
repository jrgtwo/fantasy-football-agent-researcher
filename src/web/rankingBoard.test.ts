import { describe, expect, it } from 'vitest';
import type { RankedBoard } from '../rankingTags';
import type { Player, PlayerStats } from '../data/types';
import type { PlayerRun } from './rankingTypes';
import { initialRunState } from './runReducer';
import { boardBottomLine, resolveRankedBoard } from './rankingBoard';

const mkRun = (id: string, name: string): PlayerRun => ({
  player: { id, name, position: 'QB', team: 'KC', headshot: '', status: '' } as Player,
  stats: { playerId: id, fantasyPointsPpr: 100 } as PlayerStats,
  runId: `r-${id}`,
  status: 'done',
  run: initialRunState,
});
// 3 seeded candidates → handles P1, P2, P3
const players: PlayerRun[] = [mkRun('a', 'Josh Allen'), mkRun('b', 'Drake Maye'), mkRun('c', 'Matthew Stafford')];

const board = (picks: RankedBoard['picks'], bottomLine = ''): RankedBoard => ({ picks, bottomLine });

describe('resolveRankedBoard (structured picks)', () => {
  it('maps id → seeded player and carries rank/tier/badge/note', () => {
    const out = resolveRankedBoard(
      board([
        { id: 'P3', rank: 1, tier: 1, badge: 'STEAL', note: 'Proven ceiling; ranks above Allen.' },
        { id: 'P1', rank: 2, tier: 1, note: 'Dual-threat floor.' },
      ]),
      players,
    );
    expect(out.map((p) => p.run.player.name)).toEqual(['Matthew Stafford', 'Josh Allen']);
    expect(out[0]).toMatchObject({ rank: 1, tier: '1', badge: 'steal', note: 'Proven ceiling; ranks above Allen.' });
    expect(out[1]!.badge).toBeUndefined();
  });

  it('ignores unresolved / out-of-range ids and dedupes', () => {
    const out = resolveRankedBoard(
      board([
        { id: 'P1', rank: 1, tier: 1, note: 'a' },
        { id: 'P9', rank: 2, tier: 1, note: 'out of range' },
        { id: 'P2', rank: 3, tier: 2, note: 'b' },
        { id: 'P1', rank: 4, tier: 3, note: 'dup' },
      ]),
      players,
    );
    expect(out.map((p) => p.run.player.id)).toEqual(['a', 'b']);
  });

  it('falls back to document order when rank is missing/invalid', () => {
    const out = resolveRankedBoard(
      board([
        { id: 'P2', rank: 0, tier: 1, note: 'first' },
        { id: 'P1', rank: -1, tier: 2, note: 'second' },
      ]),
      players,
    );
    expect(out.map((p) => [p.run.player.id, p.rank])).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
  });

  it('returns [] when there is no board (graceful fallback)', () => {
    expect(resolveRankedBoard(null, players)).toEqual([]);
    expect(resolveRankedBoard({ bottomLine: 'x' }, players)).toEqual([]);
  });
});

describe('boardBottomLine', () => {
  it('returns the board bottom line, else empty', () => {
    expect(boardBottomLine(board([], 'Target Allen, fade Stafford.'))).toBe('Target Allen, fade Stafford.');
    expect(boardBottomLine(null)).toBe('');
  });
});
