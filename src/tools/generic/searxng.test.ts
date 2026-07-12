import { describe, expect, it } from 'vitest';
import { searxngSearch } from './searxng';

const okFetch =
  (body: unknown): typeof fetch =>
  (async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;

describe('searxngSearch', () => {
  it('maps results, trims snippets to 200, strips www from source, respects count', async () => {
    const body = {
      results: [
        { title: 'ESPN', url: 'https://www.espn.com/nfl/x', content: 'x'.repeat(300), engine: 'google' },
        { title: 'FP', url: 'https://fantasypros.com/y', content: 'short', engine: 'bing' },
      ],
    };
    const out = await searxngSearch('http://sx:8888', 'aaron rodgers', { count: 1, fetchImpl: okFetch(body) });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      title: 'ESPN',
      url: 'https://www.espn.com/nfl/x',
      snippet: 'x'.repeat(200),
      source: 'espn.com',
    });
  });

  it('throws a friendly error when the provider is unreachable', async () => {
    const throwing = (async () => {
      throw new Error('conn refused');
    }) as unknown as typeof fetch;
    await expect(searxngSearch('http://sx', 'q', { fetchImpl: throwing })).rejects.toThrow(/SearXNG running/);
  });
});
