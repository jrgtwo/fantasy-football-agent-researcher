import { describe, expect, it } from 'vitest';
import { tokenizeInline } from './markdownInline';

describe('tokenizeInline', () => {
  it('splits bold, markdown links, and bare URLs from surrounding text', () => {
    const toks = tokenizeInline('See **Josh Allen** [profile](https://x.com/a) at https://y.com/b end');
    expect(toks).toEqual([
      { t: 'text', value: 'See ' },
      { t: 'bold', value: 'Josh Allen' },
      { t: 'text', value: ' ' },
      { t: 'link', value: 'profile', href: 'https://x.com/a' },
      { t: 'text', value: ' at ' },
      { t: 'link', value: 'https://y.com/b', href: 'https://y.com/b' },
      { t: 'text', value: ' end' },
    ]);
  });

  it('returns plain text unchanged as a single token', () => {
    expect(tokenizeInline('just words')).toEqual([{ t: 'text', value: 'just words' }]);
  });
});
