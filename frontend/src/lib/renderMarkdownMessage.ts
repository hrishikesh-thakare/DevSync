import { marked } from 'marked';
import { sanitizeMessageHtml } from '@/lib/sanitizeMessageHtml';

marked.setOptions({
  gfm: true,
  // Chat is line-per-line, not prose — a lone Enter should be a line break,
  // not silently swallowed until a full blank line starts a new paragraph.
  breaks: true,
});

/**
 * `bodyText` is markdown from the composer (`components/chat/MessageComposer.tsx`)
 * — plain `**bold**`/`_italic_`/`` `code` `` syntax typed into an ordinary
 * `<textarea>`, not HTML from a rich-text editor. This converts it to HTML for
 * display and sanitizes the result through the same allowlist the render path
 * has used since HTML rendering was introduced — `marked`'s own output tags
 * (`<strong>`, `<em>`, `<code>`, `<pre>`, `<ul>`/`<ol>`/`<li>`, `<blockquote>`,
 * `<a>`) all already sit inside that allowlist, so `sanitizeMessageHtml` did
 * not need to change for this.
 *
 * `marked` never sanitizes its own output — raw HTML pass-through in markdown
 * source is a well-known injection vector — so this sanitization step is load-
 * bearing, not defensive.
 */
export function renderMarkdownMessage(bodyText: string): string {
  if (!bodyText) return '';
  const html = marked.parse(bodyText, { async: false });
  return sanitizeMessageHtml(html);
}
