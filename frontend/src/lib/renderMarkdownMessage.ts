import { marked } from 'marked';
import { sanitizeMessageHtml } from '@/lib/sanitizeMessageHtml';

marked.setOptions({
  gfm: true,
  // Chat is line-per-line, not prose — a lone Enter should be a line break,
  // not silently swallowed until a full blank line starts a new paragraph.
  breaks: true,
});

// Matches the backend's own task-mention regex (`messages.controller.ts`'s
// `taskMentionRegex`) — same shape, same "letters, hyphen, digits" contract,
// so a key this treats as clickable is exactly a key the backend already
// resolved and notified about.
const TASK_KEY_RE = /@([A-Za-z]+-\d+)\b/g;

/**
 * Turns a task-key mention (`@DS-12`, inserted as plain text by the
 * composer's mention picker, or just typed by hand) into a real link to that
 * task's page — text nodes only, walked via `TreeWalker` rather than a regex
 * over the HTML string, so it can correctly skip anything already inside a
 * link, code span, or the user-mention markup `linkifyTaskMentions` runs
 * after. `data-type="task-mention"` on the anchor is what
 * `ChannelPage.tsx`'s click handler looks for to route through the SPA
 * instead of a full page load, and what its CSS keys off to style it
 * differently from a user mention.
 */
function linkifyTaskMentions(html: string, slug: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (parent?.closest('a, code, pre, span[data-type="mention"]')) {
        return NodeFilter.FILTER_REJECT;
      }
      TASK_KEY_RE.lastIndex = 0;
      return TASK_KEY_RE.test(node.textContent || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });

  const textNodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) textNodes.push(current as Text);

  for (const node of textNodes) {
    const text = node.textContent || '';
    TASK_KEY_RE.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TASK_KEY_RE.exec(text))) {
      const [full, key] = match;
      frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      const a = document.createElement('a');
      const projectKey = key.split('-')[0];
      a.href = `/w/${slug}/projects/${projectKey}/tasks/${key}`;
      a.dataset.type = 'task-mention';
      a.textContent = full;
      frag.appendChild(a);
      lastIndex = match.index + full.length;
    }
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    node.replaceWith(frag);
  }

  return container.innerHTML;
}

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
 * bearing, not defensive. Task-mention linkification runs strictly *after*
 * sanitization, on already-inert HTML, and only ever adds a same-origin
 * relative `href` it built itself — never anything derived from the message.
 */
export function renderMarkdownMessage(bodyText: string, slug: string): string {
  if (!bodyText) return '';
  const html = marked.parse(bodyText, { async: false });
  const sanitized = sanitizeMessageHtml(html);
  return linkifyTaskMentions(sanitized, slug);
}
