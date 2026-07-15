import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRankingCandidates } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('getRankingCandidates', () => {
  it('requests the candidates route and returns the body', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [{ player: { id: 'a' }, stats: {} }] }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await getRankingCandidates('QB', 8);
    expect(fetchMock).toHaveBeenCalledWith('/api/rankings/candidates?position=QB&n=8');
    expect(out).toHaveLength(1);
  });

  it('returns [] on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    expect(await getRankingCandidates('QB')).toEqual([]);
  });
});
