/**
 * The allowlist that decides what may be stored and how it may be served.
 *
 * Two separate jobs, deliberately in one place so they cannot drift:
 *
 *  - `isAllowedUploadMime` gates what enters the bucket at all.
 *  - `serveDisposition` decides whether a stored file may be rendered inline.
 *
 * The second is the one that matters. `getRawFile` used to echo the uploader's
 * own `mimetype` as the response `Content-Type` with `Content-Disposition:
 * inline`, which made every upload endpoint a stored-XSS primitive: upload
 * `text/html`, get a permanent link on the API origin, serve script. Only types
 * that cannot execute in a browsing context are served inline now; everything
 * else downloads.
 */

const IMAGE = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp'];
const DOCUMENT = ['application/pdf'];
const VIDEO = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const AUDIO = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4'];

// Plain text is safe to *store* but never safe to render inline from our own
// origin, so it lives here and is absent from INLINE_MIMES below.
const TEXT = ['text/plain', 'text/csv', 'text/markdown'];

const ARCHIVE = ['application/zip', 'application/gzip', 'application/x-tar'];

const OFFICE = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

const UPLOAD_MIMES = new Set([
  ...IMAGE,
  ...DOCUMENT,
  ...VIDEO,
  ...AUDIO,
  ...TEXT,
  ...ARCHIVE,
  ...OFFICE,
  'application/octet-stream',
]);

// SVG is intentionally absent: it is an image to a user and a script host to a
// browser. Allowing it inline would reopen exactly the hole this closes.
const INLINE_MIMES = new Set([...IMAGE, ...DOCUMENT, ...VIDEO, ...AUDIO]);

/** 25 MiB, measured on the decoded bytes rather than the base64 envelope. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const normalizeMime = (mimetype?: string | null): string =>
  (mimetype ?? '').split(';')[0].trim().toLowerCase();

export const isAllowedUploadMime = (mimetype?: string | null): boolean =>
  UPLOAD_MIMES.has(normalizeMime(mimetype));

/**
 * What to send for a stored file: the content type to declare, and whether the
 * browser may render it in place.
 *
 * Anything not on the inline list is served as `application/octet-stream` with
 * `attachment`, so an unexpected or spoofed type downloads instead of running.
 */
export const serveDisposition = (
  mimetype?: string | null,
): { contentType: string; disposition: 'inline' | 'attachment' } => {
  const mime = normalizeMime(mimetype);
  return INLINE_MIMES.has(mime)
    ? { contentType: mime, disposition: 'inline' }
    : { contentType: 'application/octet-stream', disposition: 'attachment' };
};

/**
 * Strips quotes and control characters from a filename before it goes into a
 * `Content-Disposition` header, where an unescaped `"` would let the uploader
 * inject header parameters.
 */
export const headerSafeFilename = (filename: string): string =>
  filename.replace(/[\r\n"\\]/g, '').slice(0, 200) || 'download';
