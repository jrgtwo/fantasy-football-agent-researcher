import type { ToolDef } from 'agent-harness';
import { searxngSearch } from './searxng';

// The user's local SearXNG instance (docker, host port 8888). Override with SEARXNG_URL if WSL can't
// reach localhost (e.g. point it at the Windows gateway IP).
const SEARXNG_URL = process.env.SEARXNG_URL ?? 'http://127.0.0.1:8888';

// Generic research tool: discovery. FF-free (the football lives in the analyst prompt) → a
// tools/generic promotion candidate. Consent-gated. Pairs with fetch_url (which reads a chosen URL).
export const webSearch: ToolDef = {
  name: 'web_search',
  description:
    'Search the web (via SearXNG) and return the top results as {title, url, snippet}. Use this to FIND ' +
    'current sources; then call fetch_url on a chosen result URL to read it in full. Do not guess URLs.',
  mode: 'confirm',
  params: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query.' },
      count: { type: 'number', description: 'Max results to return (default 5).' },
    },
    required: ['query'],
    additionalProperties: false,
  },
  handler: async (args: { query: string; count?: number }) => {
    const results = await searxngSearch(SEARXNG_URL, args.query, { count: args.count });
    return { query: args.query, results };
  },
};
