import type { PlayerRun } from './rankingTypes';

// Hydrate the ranker's markdown board into real cards. The app seeded the candidates and tagged each
// with a handle ([[Pn]] = the nth candidate) in the ranker's INPUT (composeRankerInput); the ranker
// echoes those handles back at the head of each numbered line. Parsing the exact token is robust —
// no fuzzy name-matching — and the card data comes from the record we already hold, not the model.

const MAX_RANKED = 5;
// A numbered ranked line whose entry begins with a handle: optional bold, "1." or "1)", then [[Pn]].
// Anchoring to the line start ignores handles that appear inside a line's comparative reasoning.
const RANKED_LINE = /^\s*\**\s*(\d+)[.)]\s*\**\s*\[\[P(\d+)\]\]/;

/** Handle numbers (the `n` in `[[Pn]]`) from the numbered ranked lines, in the order listed. */
export function parseRankedHandles(answer: string): number[] {
  const handles: number[] = [];
  for (const line of answer.split('\n')) {
    const m = line.match(RANKED_LINE);
    if (m) handles.push(Number(m[2]));
  }
  return handles;
}

export interface RankedPick {
  run: PlayerRun;
  rank: number; // 1-based, in the order rendered (not the model's printed number)
  note: string; // the ranker's line for this pick, with the [[Pn]] handle stripped
}

/**
 * Resolve the ranked lines to seeded players: handle `n` → `players[n-1]`. Drops out-of-range and
 * duplicate handles, caps at the top 5, and carries each pick's line text (handle removed) as its
 * note. Returns [] when nothing resolves — the caller falls back to showing prose only.
 */
export function resolveRankedPlayers(answer: string, players: PlayerRun[]): RankedPick[] {
  const picks: RankedPick[] = [];
  const seen = new Set<number>();
  for (const line of answer.split('\n')) {
    const m = line.match(RANKED_LINE);
    if (!m) continue;
    const n = Number(m[2]);
    const run = players[n - 1];
    if (!run || seen.has(n)) continue;
    seen.add(n);
    const note = line.slice(m[0].length).replace(/^[\s—–-]*/, '').trim();
    picks.push({ run, rank: picks.length + 1, note });
    if (picks.length >= MAX_RANKED) break;
  }
  return picks;
}
