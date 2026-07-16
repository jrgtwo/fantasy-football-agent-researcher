import { describe, expect, it } from 'vitest';
import type { Player, PlayerStats } from '../data/types';
import type { PlayerRun } from './rankingTypes';
import { initialRunState } from './runReducer';
import { boardProse, resolveRankedPlayers } from './rankingBoard';

const mkRun = (id: string, name: string): PlayerRun => ({
  player: { id, name, position: 'QB', team: 'KC', headshot: '', status: '' } as Player,
  stats: { playerId: id, fantasyPointsPpr: 100 } as PlayerStats,
  runId: `r-${id}`,
  status: 'done',
  run: initialRunState,
});
// 3 seeded candidates → handles P1, P2, P3
const players: PlayerRun[] = [mkRun('a', 'Josh Allen'), mkRun('b', 'Drake Maye'), mkRun('c', 'Matthew Stafford')];

const tag = (id: string, rank: string, tier: string, note: string, badge?: string) =>
  `{% player id="${id}" rank="${rank}" tier="${tier}"${badge ? ` badge="${badge}"` : ''} %}${note}{% /player %}`;

describe('resolveRankedPlayers (Markdoc tags)', () => {
  it('maps id → seeded player and carries rank/tier/badge/note', () => {
    const answer = [
      'Here is the board:',
      tag('P3', '1', '1', 'Proven ceiling; ranks above Allen.', 'steal'),
      tag('P1', '2', '1', 'Dual-threat floor.'),
    ].join('\n\n');
    const out = resolveRankedPlayers(answer, players);
    expect(out.map((p) => p.run.player.name)).toEqual(['Matthew Stafford', 'Josh Allen']);
    expect(out[0]).toMatchObject({ rank: 1, tier: '1', badge: 'steal', note: 'Proven ceiling; ranks above Allen.' });
    expect(out[1]!.badge).toBeUndefined();
  });

  it('ignores unresolved / out-of-range ids and dedupes', () => {
    const answer = [
      tag('P1', '1', '1', 'a'),
      tag('P9', '2', '1', 'out of range'),
      tag('P2', '3', '2', 'b'),
      tag('P1', '4', '3', 'dup'),
    ].join('\n');
    expect(resolveRankedPlayers(answer, players).map((p) => p.run.player.id)).toEqual(['a', 'b']);
  });

  it('falls back to document order when rank attr is missing/invalid', () => {
    const answer = `{% player id="P2" %}first{% /player %}\n{% player id="P1" tier="2" %}second{% /player %}`;
    const out = resolveRankedPlayers(answer, players);
    expect(out.map((p) => [p.run.player.id, p.rank])).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
  });

  it('ignores an unclosed (streaming) tag — only complete tags hydrate', () => {
    const answer = `${tag('P1', '1', '1', 'done')}\n{% player id="P2" rank="2" tier="1" %}still streaming…`;
    const out = resolveRankedPlayers(answer, players);
    expect(out.map((p) => p.run.player.id)).toEqual(['a']);
  });

  it('returns [] when no tags parse (graceful fallback to prose-only)', () => {
    expect(resolveRankedPlayers('1. **Josh Allen** — no tags here.', players)).toEqual([]);
  });
});

describe('boardProse', () => {
  it('strips player tags, leaving the bottom-line prose', () => {
    const answer = `${tag('P1', '1', '1', 'note')}\n\nBottom line: target Allen, fade Stafford.`;
    expect(boardProse(answer)).toBe('Bottom line: target Allen, fade Stafford.');
  });
});
