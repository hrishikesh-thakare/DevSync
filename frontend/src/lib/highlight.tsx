import type { ReactNode } from 'react';

/**
 * Renders a Postgres `ts_headline` snippet.
 *
 * The server returns text wrapped in `<mark>…</mark>` around the matched terms.
 * That string is user-authored content, so it is never handed to
 * `dangerouslySetInnerHTML` — instead it is split on the marker tags and the
 * pieces are emitted as React nodes. Anything else that looks like a tag stays
 * inert text, which makes injection impossible rather than merely filtered.
 */
export function renderSnippet(snippet: string | null | undefined): ReactNode {
  if (!snippet) return null;

  const parts = snippet.split(/(<mark>[\s\S]*?<\/mark>)/g);

  return parts.map((part, i) => {
    const match = /^<mark>([\s\S]*?)<\/mark>$/.exec(part);
    if (match) {
      return (
        <mark key={i} className="rounded bg-primary/25 px-0.5 text-foreground">
          {decodeEntities(match[1])}
        </mark>
      );
    }
    return <span key={i}>{decodeEntities(part)}</span>;
  });
}

/** ts_headline escapes the source text, so the common entities are decoded back. */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
