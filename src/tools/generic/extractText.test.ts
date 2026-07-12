import { describe, expect, it } from 'vitest';
import { extractText } from './extractText';

describe('extractText', () => {
  it('strips HTML tags, leaving the text', () => {
    expect(extractText('<p>Hello <b>world</b></p>', 100)).toBe('Hello world');
  });

  it('drops script and style contents entirely', () => {
    expect(extractText('<style>p{color:red}</style><p>Hi</p><script>alert(1)</script>', 100)).toBe('Hi');
  });

  it('collapses runs of whitespace', () => {
    expect(extractText('a\n\n   b\t c', 100)).toBe('a b c');
  });

  it('caps the result at maxChars', () => {
    expect(extractText('abcdefghij', 4)).toBe('abcd');
  });
});
