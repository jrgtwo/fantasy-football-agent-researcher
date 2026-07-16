import type { ReactNode } from 'react';

// A tiny, safe inline-markdown renderer: **bold**, [label](url), and bare URLs → links. Emits React
// nodes (no dangerouslySetInnerHTML, so model text can't inject markup). Covers what the ranker's
// notes actually contain (bold names, source URLs); NOT a full markdown engine — that's the
// react-markdown / Markdoc graduation if we ever need headings/lists/tables/streaming-hardening.

type Token =
  | { t: 'text'; value: string }
  | { t: 'bold'; value: string }
  | { t: 'link'; value: string; href: string };

const PATTERN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s)]+)/g;

export function tokenizeInline(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  PATTERN.lastIndex = 0;
  while ((m = PATTERN.exec(text)) !== null) {
    if (m.index > last) tokens.push({ t: 'text', value: text.slice(last, m.index) });
    if (m[1] !== undefined) tokens.push({ t: 'bold', value: m[1] });
    else if (m[2] !== undefined) tokens.push({ t: 'link', value: m[2], href: m[3]! });
    else if (m[4] !== undefined) tokens.push({ t: 'link', value: m[4], href: m[4] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ t: 'text', value: text.slice(last) });
  return tokens;
}

export function MarkdownInline({ text, className }: { text: string; className?: string }): ReactNode {
  return (
    <span className={className}>
      {tokenizeInline(text).map((tok, i) => {
        if (tok.t === 'bold') return <strong key={i}>{tok.value}</strong>;
        if (tok.t === 'link')
          return (
            <a key={i} href={tok.href} target="_blank" rel="noreferrer noopener">
              {tok.value}
            </a>
          );
        return <span key={i}>{tok.value}</span>;
      })}
    </span>
  );
}
