import type { UiTagDef } from 'agent-harness/client';

// The `player` UI tag, declared ONCE. The ranker agent attaches it (so the harness teaches the model
// how to emit it) and the board renderer parses it (so the harness finds it) — FF only writes the
// card component. `import type` keeps this browser-safe (no runtime harness pulled into the bundle).
export const PLAYER_TAG: UiTagDef = {
  name: 'player',
  description: 'a player card for a ranked pick',
  attributes: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      rank: { type: 'string' },
      tier: { type: 'string' },
      badge: { type: 'string' },
    },
    required: ['id'],
  },
};
