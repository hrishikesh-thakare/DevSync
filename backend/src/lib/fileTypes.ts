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

// This is a coding-collaboration tool, so source files are a first-class
// attachment type, not an edge case. Browsers are wildly inconsistent about
// what `File.type` they report for these — most unregistered extensions come
// through as `''` (already covered by the `application/octet-stream` default
// below), but some OS/browser combinations *do* guess a specific type, and
// that guess needs to be on the allowlist too. Like TEXT, none of these are
// in INLINE_MIMES: source is served as a download, never rendered in-origin.
const CODE = [
  'text/x-python',
  'text/x-python-script',
  'application/x-python-code',
  'text/x-java',
  'text/x-java-source',
  'text/x-c',
  'text/x-csrc',
  'text/x-chdr',
  'text/x-c++src',
  'text/x-c++hdr',
  'text/x-csharp',
  'text/x-go',
  'text/x-rustsrc',
  'text/x-ruby',
  'text/x-php',
  'application/x-httpd-php',
  'text/x-perl',
  'text/x-swift',
  'text/x-kotlin',
  'text/x-scala',
  'text/x-sh',
  'application/x-sh',
  'application/x-shellscript',
  'text/x-yaml',
  'application/x-yaml',
  'application/toml',
  'text/javascript',
  'application/javascript',
  'text/typescript',
  'application/typescript',
  'application/json',
  'text/css',
  'text/html',
  'application/xml',
  'text/xml',
  'application/sql',
  'text/x-sql',
];

const UPLOAD_MIMES = new Set([
  ...IMAGE,
  ...DOCUMENT,
  ...VIDEO,
  ...AUDIO,
  ...TEXT,
  ...ARCHIVE,
  ...OFFICE,
  ...CODE,
  'application/octet-stream',
]);

// Belt-and-suspenders for the same problem from the other direction: rather
// than chase every mimetype a browser might invent for a source file, accept
// on file extension too. A `.py`/`.java`/whatever upload that somehow arrives
// with an unrecognized, non-empty mimetype (some browser/OS-specific guess
// not in the CODE list above) still lands here instead of a hard rejection.
const CODE_EXTENSIONS = new Set([
  'py', 'java', 'c', 'h', 'cpp', 'cc', 'hpp', 'cs', 'go', 'rs', 'rb', 'php',
  'pl', 'swift', 'kt', 'kts', 'scala', 'sh', 'bash', 'zsh', 'ps1', 'sql',
  'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env', 'json', 'xml', 'html',
  'htm', 'css', 'scss', 'less', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'vue',
  'r', 'm', 'lua', 'dart', 'ex', 'exs', 'erl', 'clj', 'hs', 'jl', 'sol',
  'proto', 'graphql', 'dockerfile', 'makefile', 'gitignore', 'editorconfig',
  'txt', 'log', 'diff', 'patch', 'gradle', 'lock',
]);

const hasAllowedCodeExtension = (filename?: string | null): boolean => {
  if (!filename) return false;
  const ext = filename.split('.').pop()?.toLowerCase();
  return !!ext && ext !== filename.toLowerCase() && CODE_EXTENSIONS.has(ext);
};

// SVG is intentionally absent: it is an image to a user and a script host to a
// browser. Allowing it inline would reopen exactly the hole this closes.
const INLINE_MIMES = new Set([...IMAGE, ...DOCUMENT, ...VIDEO, ...AUDIO]);

/** 25 MiB, measured on the decoded bytes rather than the base64 envelope. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const normalizeMime = (mimetype?: string | null): string =>
  (mimetype ?? '').split(';')[0].trim().toLowerCase();

export const isAllowedUploadMime = (mimetype?: string | null, filename?: string | null): boolean =>
  UPLOAD_MIMES.has(normalizeMime(mimetype)) || hasAllowedCodeExtension(filename);

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
