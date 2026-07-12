import type { ToolDef } from 'agent-harness';
import { extractText } from './extractText';

const MAX_CHARS = 6000;

// Generic research tool: fetch a URL and return readable text. FF-free — the football lives in the
// analyst prompt, not here — so it's a promotion candidate under tools/generic/. Chosen over
// web_search for v1 because it needs no infra (SearXNG / API key). mode:'confirm' → consent-gated.
export const fetchUrl: ToolDef = {
  name: 'fetch_url',
  description:
    'Fetch a web page or JSON API by absolute URL and return its text content (HTML stripped, trimmed). ' +
    'Use this to research current information the stats do not show — injury news, matchups, recent form.',
  mode: 'confirm',
  params: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Absolute http(s) URL to fetch.' },
    },
    required: ['url'],
    additionalProperties: false,
  },
  handler: async (args: { url: string }) => {
    const res = await fetch(args.url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ff-analyst/0.1)' },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text();
    return { url: args.url, status: res.status, text: extractText(body, MAX_CHARS) };
  },
};
