// The ranker's output contract, declared ONCE. The ranker agent attaches the JSON Schema
// (`outputSchema`, so the harness grammar-enforces the shape) and the board renderer consumes the
// matching TS type — FF only writes the card component. Replaces the old `{% player %}` tag path:
// the model now returns validated data, not prose we parse.

/** One ranked pick as the model emits it (ids are the P1..Pn handles from the input). */
export interface RankedPickData {
  id: string;
  rank: number;
  tier: number;
  badge?: string;
  note: string;
}

/** The ranker's whole board. */
export interface RankedBoard {
  picks: RankedPickData[];
  bottomLine: string;
}

/** JSON Schema the harness enforces on the ranker's answer (see `rankerAgent`). */
export const RANKER_BOARD_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['picks', 'bottomLine'],
  properties: {
    picks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'rank', 'tier', 'note'],
        properties: {
          id: { type: 'string', description: "the player's exact id from the input (P1, P2, …)" },
          rank: { type: 'integer', description: '1..5' },
          tier: { type: 'integer', description: '1..5, grouped so tier breaks are meaningful' },
          badge: { type: 'string', description: 'OPTIONAL short caps label: VALUE, STEAL, SLEEPER, FADE, ANCHOR' },
          note: { type: 'string', description: 'comparative take vs the next player; refer to others by NAME' },
        },
      },
    },
    bottomLine: { type: 'string', description: '1-2 sentence take: who to target, who to avoid, how to read tiers' },
  },
};
