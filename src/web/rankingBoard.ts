import type { PlayerRun } from './rankingTypes';

// Hydrate the ranker's board into enriched cards. The ranker emits each pick as a Markdoc tag:
//   {% player id="P3" rank="1" tier="1" badge="steal" %}comparative note (markdown){% /player %}
// The app seeded the candidates and tagged each with an id (P1..P8) in the ranker's INPUT, so `id`
// resolves by exact lookup — no name matching. Props come from three places: id -> our data,
// attributes -> the agent's structured fields (rank/tier/badge), body -> the agent's freeform note.
// Only fully-closed tags match, so this parses partial/streaming output gracefully.

const MAX_PICKS = 6; // top 5 + a possible sleeper
const PLAYER_TAG = /\{%\s*player\b([^%]*?)%\}([\s\S]*?)\{%\s*\/player\s*%\}/g;

function attr(raw: string, name: string): string | undefined {
  const m = raw.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`));
  return m?.[1];
}
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
 * Parse the ranker's `{% player %}` tags into enriched picks, resolving each `id` to the seeded
 * player record. Drops unresolved/duplicate ids, caps at MAX_PICKS. Returns [] when nothing parses
 * (the caller falls back to prose-only).
 */
export function resolveRankedPlayers(answer: string, players: PlayerRun[]): RankedPick[] {
  const picks: RankedPick[] = [];
  const seen = new Set<number>();
  let m: RegExpExecArray | null;
  PLAYER_TAG.lastIndex = 0;
  while ((m = PLAYER_TAG.exec(answer)) !== null) {
    const raw = m[1] ?? '';
    const idx = handleIndex(attr(raw, 'id'));
    if (idx === null) continue;
    const run = players[idx - 1];
    if (!run || seen.has(idx)) continue;
    seen.add(idx);
    const rankAttr = Number(attr(raw, 'rank'));
    picks.push({
      run,
      rank: Number.isFinite(rankAttr) && rankAttr > 0 ? rankAttr : picks.length + 1,
      tier: attr(raw, 'tier'),
      badge: attr(raw, 'badge')?.toLowerCase(),
      note: (m[2] ?? '').trim(),
    });
    if (picks.length >= MAX_PICKS) break;
  }
  return picks;
}

/** The board's prose with the `{% player %}` tags removed — i.e. the ranker's bottom-line take. */
export function boardProse(answer: string): string {
  return answer.replace(PLAYER_TAG, '').replace(/\n{3,}/g, '\n\n').trim();
}
