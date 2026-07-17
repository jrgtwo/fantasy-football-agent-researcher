import { parseUiTags, stripUiTags } from 'agent-harness/client';
import { PLAYER_TAG } from '../rankingTags';
import type { PlayerRun } from './rankingTypes';

// Hydrate the ranker's board into enriched cards. The harness finds the `{% player %}` tags (parseUiTags
// / stripUiTags) — FF only maps each tag's id to the seeded player record and shapes the pick. Props
// come from three places: id → our data, attributes (rank/tier/badge) → the agent's fields, body → note.

const MAX_PICKS = 6; // top 5 + a possible sleeper
const handleIndex = (id: string | undefined): number | null => {
  const m = id?.match(/P(\d+)/i);
  return m ? Number(m[1]) : null;
};

export interface RankedPick {
  run: PlayerRun;
  rank: number; // from the tag's rank attr, else document order
  tier?: string;
  badge?: string; // steal | sleeper | fade | …
  note: string; // the agent's freeform note (markdown)
}

/**
 * Resolve the ranker's parsed `player` tags to seeded player records. Drops unresolved/duplicate ids,
 * caps at MAX_PICKS. Returns [] when nothing parses (the caller falls back to prose-only).
 */
export function resolveRankedPlayers(answer: string, players: PlayerRun[]): RankedPick[] {
  const picks: RankedPick[] = [];
  const seen = new Set<number>();
  for (const tag of parseUiTags(answer, [PLAYER_TAG])) {
    const idx = handleIndex(tag.attributes.id);
    if (idx === null) continue;
    const run = players[idx - 1];
    if (!run || seen.has(idx)) continue;
    seen.add(idx);
    const rankAttr = Number(tag.attributes.rank);
    picks.push({
      run,
      rank: Number.isFinite(rankAttr) && rankAttr > 0 ? rankAttr : picks.length + 1,
      tier: tag.attributes.tier,
      badge: tag.attributes.badge?.toLowerCase(),
      note: tag.body,
    });
    if (picks.length >= MAX_PICKS) break;
  }
  return picks;
}

/** The board's prose with the `{% player %}` tags removed — i.e. the ranker's bottom-line take. */
export function boardProse(answer: string): string {
  return stripUiTags(answer, [PLAYER_TAG]);
}
