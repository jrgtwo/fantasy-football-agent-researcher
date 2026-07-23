import type { RankedBoard } from '../rankingTags';
import type { PlayerRun } from './rankingTypes';

// Hydrate the ranker's structured board into enriched cards. The harness grammar-enforces the shape
// and hands us validated data (RankedBoard) — FF only maps each pick's id to the seeded player record
// and shapes the card. Props come from three places: id → our data, rank/tier/badge → the model's
// fields, note → the comparative body.

const MAX_PICKS = 5;
const handleIndex = (id: string | undefined): number | null => {
  const m = id?.match(/P(\d+)/i);
  return m ? Number(m[1]) : null;
};

export interface RankedPick {
  run: PlayerRun;
  rank: number; // from the pick's rank field, else document order
  tier?: string;
  badge?: string; // steal | sleeper | fade | …
  note: string; // the agent's freeform note (markdown)
}

/**
 * Resolve the ranker's structured picks to seeded player records. Drops unresolved/duplicate ids,
 * caps at MAX_PICKS. Returns [] when there's no board (the caller falls back to the raw answer).
 */
export function resolveRankedBoard(structured: unknown, players: PlayerRun[]): RankedPick[] {
  const board = structured as RankedBoard | null;
  if (!board || !Array.isArray(board.picks)) return [];
  const picks: RankedPick[] = [];
  const seen = new Set<number>();
  for (const p of board.picks) {
    const idx = handleIndex(p?.id);
    if (idx === null) continue;
    const run = players[idx - 1];
    if (!run || seen.has(idx)) continue;
    seen.add(idx);
    picks.push({
      run,
      rank: Number.isFinite(p.rank) && p.rank > 0 ? p.rank : picks.length + 1,
      tier: p.tier != null ? String(p.tier) : undefined,
      badge: typeof p.badge === 'string' && p.badge ? p.badge.toLowerCase() : undefined,
      note: typeof p.note === 'string' ? p.note : '',
    });
    if (picks.length >= MAX_PICKS) break;
  }
  return picks;
}

/** The board's bottom-line take (plain prose). */
export function boardBottomLine(structured: unknown): string {
  const board = structured as RankedBoard | null;
  return typeof board?.bottomLine === 'string' ? board.bottomLine : '';
}
