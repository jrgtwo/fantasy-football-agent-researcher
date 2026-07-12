export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

// Client for a self-hosted SearXNG instance (JSON API). Ported from agent-practice's SearxngProvider.
// Generic (no football here) → a tools/generic promotion candidate. fetchImpl is injectable for tests.

interface SearxngItem {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
}

const SNIPPET_MAX = 200;
const DEFAULT_COUNT = 5;
const MAX_COUNT = 15;

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export async function searxngSearch(
  baseUrl: string,
  query: string,
  opts: { count?: number; fetchImpl?: typeof fetch } = {},
): Promise<SearchResult[]> {
  const count = Math.max(1, Math.min(MAX_COUNT, opts.count ?? DEFAULT_COUNT));
  const doFetch = opts.fetchImpl ?? fetch; // unbound: native fetch throws "Illegal invocation" as a method
  const url = `${baseUrl.replace(/\/$/, '')}/search?q=${encodeURIComponent(query)}&format=json`;

  let res: Response;
  try {
    res = await doFetch(url);
  } catch {
    throw new Error("couldn't reach the search provider — is SearXNG running?");
  }
  if (!res.ok) throw new Error(`search provider error (HTTP ${res.status}).`);

  const body = (await res.json()) as { results?: SearxngItem[] };
  const items = Array.isArray(body.results) ? body.results : [];
  return items.slice(0, count).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    snippet: String(r.content ?? '').slice(0, SNIPPET_MAX),
    source: host(r.url ?? '') || String(r.engine ?? ''),
  }));
}
