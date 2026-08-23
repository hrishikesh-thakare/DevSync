import DOMPurify from 'dompurify';

/**
 * Sanitizes rich-text message HTML before it is rendered.
 *
 * `bodyText` is markdown (see `components/chat/MessageComposer.tsx` and
 * `lib/renderMarkdownMessage.ts`, which converts it to HTML and calls this in
 * the same step) — `marked` never sanitizes its own output, so this step is
 * load-bearing. Covered by `e2e/tests/channels/messages.spec.ts`'s "XSS
 * sanitization" suite, which this allowlist is written to satisfy exactly:
 * zero `<img>`, `<script>`, `<iframe>`, any `on*` handler, or `javascript:`
 * href must survive.
 *
 * The allowed tags are exactly what `marked` (with `gfm: true`) can produce
 * from the composer's toolbar — verified directly against `marked`'s actual
 * output rather than assumed; `del` is here because GFM strikethrough
 * renders `<del>`, not `<s>`. `span`/`data-type`/`data-id` stay allowed for
 * the backend's mention markup (`messages.controller.ts` regex-matches
 * `data-type="mention"`) even though nothing currently emits it — inert
 * attributes, no XSS surface, and cheap forward-compatibility. Legacy
 * plain-text messages sent before any of this existed pass through
 * unchanged: DOMPurify treats unrecognised `<` as literal text if it isn't a
 * real tag, and their newlines are preserved by the `white-space: pre-wrap`
 * the message body still carries.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 's', 'del', 'code', 'pre',
  'ul', 'ol', 'li', 'blockquote', 'a', 'span',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'data-type', 'data-id'];

export function sanitizeMessageHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Belt-and-braces alongside the allowlist above — DOMPurify already
    // strips these by default, but the XSS suite treats their presence as a
    // hard failure, so they are named explicitly rather than trusted to
    // default behaviour surviving a future DOMPurify config change.
    FORBID_TAGS: ['img', 'script', 'iframe', 'style', 'svg', 'object', 'embed'],
    FORBID_ATTR: [
      'style', 'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseenter', 'onfocus',
    ],
  });
}
