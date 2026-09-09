/** The first http(s) URL in a message body, or null. */
export function firstUrlIn(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"')]+/i);
  return match ? match[0] : null;
}
