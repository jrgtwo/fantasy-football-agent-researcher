import { describe, expect, it } from 'vitest';
import type { Player, PlayerStats } from '../data/types';
import type { PlayerRun } from './rankingTypes';
import { initialRunState } from './runReducer';
import { parseRankedHandles, resolveRankedPlayers } from './rankingBoard';

const mkRun = (id: string, name: string): PlayerRun => ({
  player: { id, name, position: 'QB', team: 'KC', headshot: '', status: '' } as Player,
  stats: { playerId: id, fantasyPointsPpr: 100 } as PlayerStats,
  runId: `r-${id}`,
  status: 'done',
  run: initialRunState,
});
// 3 seeded candidates → handles P1, P2, P3
const players: PlayerRun[] = [mkRun('a', 'Josh Allen'), mkRun('b', 'Drake Maye'), mkRun('c', 'Matthew Stafford')];

describe('parseRankedHandles', () => {
  it('extracts handle numbers from numbered lines in rank order', () => {
    const answer = [
      '1. [[P3]] **Matthew Stafford** (Tier 1) — proven ceiling.',
      '2. [[P1]] **Josh Allen** (Tier 1) — dual-threat floor.',
      '3. [[P2]] **Drake Maye** (Tier 2) — breakout upside.',
      '',
      'Best value / steal: [[P2]] — cheap upside.',
    ].join('\n');
    // top-5 lines only (ranked list), NOT the callout line that also references [[P2]]
    expect(parseRankedHandles(answer)).toEqual([3, 1, 2]);
  });

  it('tolerates bold, ) delimiter, and inline handles in the reasoning', () => {
    const answer = [
      '**1)** [[P2]] Drake Maye — ranks above [[P3]] on upside.',
      '2. [[P3]] Matthew Stafford — ceiling but risk.',
    ].join('\n');
    expect(parseRankedHandles(answer)).toEqual([2, 3]); // inline [[P3]] on line 1 is ignored
  });

  it('returns [] when no handles are echoed', () => {
    expect(parseRankedHandles('1. **Josh Allen** (Tier 1) — no handle here.')).toEqual([]);
  });
});

describe('resolveRankedPlayers', () => {
  it('maps handles to the seeded players in rank order with the ranker note', () => {
    const answer = '1. [[P3]] **Matthew Stafford** (Tier 1) — proven.\n2. [[P1]] **Josh Allen** (Tier 1) — floor.';
    const out = resolveRankedPlayers(answer, players);
    expect(out.map((r) => r.run.player.name)).toEqual(['Matthew Stafford', 'Josh Allen']);
    expect(out[0]!.rank).toBe(1);
    expect(out[0]!.note).toContain('proven'); // note = the line text minus the handle
    expect(out[0]!.note).not.toContain('[[P3]]');
  });

  it('ignores out-of-range or unmatched handles and dedupes, capping at 5', () => {
    const answer = [
      '1. [[P1]] a', '2. [[P9]] out of range', '3. [[P2]] b', '4. [[P1]] dup', '5. [[P3]] c',
      '6. [[P3]] sixth',
    ].join('\n');
    const out = resolveRankedPlayers(answer, players);
    expect(out.map((r) => r.run.player.id)).toEqual(['a', 'b', 'c']); // P9 dropped, P1 dup dropped
  });

  it('returns [] when nothing resolves (graceful fallback to prose-only)', () => {
    expect(resolveRankedPlayers('no handles at all', players)).toEqual([]);
  });
});
