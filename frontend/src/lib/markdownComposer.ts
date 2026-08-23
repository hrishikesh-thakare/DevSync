/**
 * Pure text-manipulation helpers behind the composer's toolbar.
 *
 * Deliberately not an editor library. Every function here takes a plain
 * string plus a selection range and returns a new string plus a new
 * selection range — ordinary, verifiable string logic, not an internal
 * document/state-machine model whose correctness has to be trusted rather
 * than read. `MessageComposer.tsx` is the only caller; it applies the result
 * to a `<textarea>` via `setSelectionRange`.
 */

export interface EditResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Wraps the selection in `before`/`after` markers, toggling them off if the
 * selection is already exactly wrapped — so clicking Bold twice on the same
 * text un-bolds it, the behaviour a "toggle" is expected to have even though
 * nothing here tracks live formatting state the way an editor would.
 */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string = before,
): EditResult {
  const selected = value.slice(start, end);
  const beforeCtx = value.slice(Math.max(0, start - before.length), start);
  const afterCtx = value.slice(end, end + after.length);

  if (beforeCtx === before && afterCtx === after) {
    // Already wrapped — remove the markers instead of nesting them.
    return {
      value: value.slice(0, start - before.length) + selected + value.slice(end + after.length),
      selectionStart: start - before.length,
      selectionEnd: end - before.length,
    };
  }

  const placeholder = selected || 'text';
  return {
    value: value.slice(0, start) + before + placeholder + after + value.slice(end),
    selectionStart: start + before.length,
    selectionEnd: start + before.length + placeholder.length,
  };
}

/** Wraps the selection as a fenced code block on its own lines. */
export function wrapCodeBlock(value: string, start: number, end: number): EditResult {
  const selected = value.slice(start, end) || 'code';
  const needsLeadingBreak = start > 0 && value[start - 1] !== '\n';
  const needsTrailingBreak = end < value.length && value[end] !== '\n';

  const open = `${needsLeadingBreak ? '\n' : ''}\`\`\`\n`;
  const close = `\n\`\`\`${needsTrailingBreak ? '\n' : ''}`;

  return {
    value: value.slice(0, start) + open + selected + close + value.slice(end),
    selectionStart: start + open.length,
    selectionEnd: start + open.length + selected.length,
  };
}

/**
 * Prefixes every line the selection touches with `prefix` — the multi-line
 * form lists, blockquotes need. Re-selecting after a list/quote toggle and
 * clicking again removes the prefix instead of doubling it.
 */
export function prefixLines(
  value: string,
  start: number,
  end: number,
  prefix: string,
): EditResult {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = value.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = value.length;

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const allPrefixed = lines.every((l) => l.startsWith(prefix) || l.length === 0);

  const nextLines = allPrefixed
    ? lines.map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : l))
    : lines.map((l) => (l.length === 0 ? l : prefix + l));

  const nextBlock = nextLines.join('\n');
  const delta = nextBlock.length - block.length;

  return {
    value: value.slice(0, lineStart) + nextBlock + value.slice(lineEnd),
    selectionStart: Math.max(lineStart, start + (allPrefixed ? -prefix.length : prefix.length)),
    selectionEnd: Math.max(lineStart, end + delta),
  };
}

/** Numbered-list prefix. Every line uses `1.` — CommonMark renumbers a list from its first marker regardless of the literal digits that follow, so this still renders 1, 2, 3, … */
export const prefixOrderedList = (value: string, start: number, end: number): EditResult =>
  prefixLines(value, start, end, '1. ');

export const prefixBulletList = (value: string, start: number, end: number): EditResult =>
  prefixLines(value, start, end, '- ');

export const prefixBlockquote = (value: string, start: number, end: number): EditResult =>
  prefixLines(value, start, end, '> ');

/** Inserts a markdown link, wrapping the selection as the link text. */
export function insertLink(
  value: string,
  start: number,
  end: number,
  url: string,
): EditResult {
  const selected = value.slice(start, end) || 'link text';
  const markup = `[${selected}](${url})`;
  const textStart = start + 1; // just past '['
  return {
    value: value.slice(0, start) + markup + value.slice(end),
    selectionStart: textStart,
    selectionEnd: textStart + selected.length,
  };
}
