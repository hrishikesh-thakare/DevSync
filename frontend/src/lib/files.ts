/**
 * Helpers for the JSON upload path the task attachment endpoint uses.
 *
 * `POST /tasks/:taskKey/attachments` takes the whole file as base64 inside the
 * request body — there is no multipart handler — so the browser has to encode
 * it first. Express is configured with `limit: '50mb'`, and base64 inflates by
 * about a third, which is where MAX_UPLOAD_BYTES comes from.
 */

import { FileTextIcon, MicIcon, VideoIcon, type LucideIcon } from 'lucide-react';

/** 30 MiB of file ≈ 40 MB of base64, comfortably inside the server's 50mb cap. */
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

/** The `filetype` enum the backend validates against. */
export type Filetype = 'image' | 'pdf' | 'code' | 'video' | 'audio' | 'other';

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'py', 'rb', 'go', 'rs', 'java',
  'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'sh', 'sql', 'yml', 'yaml', 'toml',
  'html', 'css', 'scss', 'md', 'diff', 'patch',
]);

export function classifyFile(file: File): Filetype {
  const mime = file.type;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  return 'other';
}

export function getFileVariant(mimetype: string | null | undefined, filename: string = ''): 'image' | 'video' | 'audio' | 'pdf' | 'code' | 'icon' {
  if (mimetype?.startsWith('image/')) return 'image';
  if (mimetype?.startsWith('video/')) return 'video';
  if (mimetype?.startsWith('audio/')) return 'audio';
  if (mimetype === 'application/pdf') return 'pdf';

  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  return 'icon';
}

/**
 * Reads a File into a bare base64 string.
 *
 * `FileReader.readAsDataURL` yields `data:<mime>;base64,<payload>`; the server
 * calls `Buffer.from(fileBase64, 'base64')` directly, so the prefix has to go —
 * leaving it on corrupts the first bytes of every stored file.
 *
 * The split point is the literal `;base64,` marker, not "the first comma" —
 * a recorded video/audio note's `file.type` is `MediaRecorder.mimeType`,
 * typically `video/webm;codecs=vp8,opus`, and that comma inside the codecs
 * list comes *before* the real separator. Splitting on the first comma sliced
 * from the middle of "vp8,opus", leaving `opus;base64,` glued onto the front
 * of the payload — not valid base64, silently mangled by the decoder into a
 * corrupt file. Every recording was broken this way; plain uploads never hit
 * it because an ordinary `file.type` (`image/png`, `application/pdf`, ...)
 * never contains a comma.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const marker = ';base64,';
      const markerIndex = result.indexOf(marker);
      resolve(markerIndex === -1 ? result : result.slice(markerIndex + marker.length));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * The generic (non-image) icon for an attachment card — images render an
 * actual thumbnail instead, so this is only ever consulted for the
 * `variant="icon"` case. Recordings made through the composer's own
 * record-video/record-voice buttons are plain video/webm and audio/webm
 * files by the time they reach here, indistinguishable from an uploaded
 * clip — same icon either way.
 */
export function attachmentIcon(mimetype: string | undefined): LucideIcon {
  if (mimetype?.startsWith('video/')) return VideoIcon;
  if (mimetype?.startsWith('audio/')) return MicIcon;
  return FileTextIcon;
}

/**
 * Whether a mimetype is one the browser can render in place — matches the
 * backend's own `INLINE_MIMES` (`backend/src/lib/fileTypes.ts`) exactly:
 * images, PDFs, video, audio. The server only ever answers
 * `Content-Disposition: inline` for these; everything else — code, archives,
 * office docs, plain text — comes back `attachment` regardless of what a
 * `target="_blank"` link asks for.
 *
 * That mismatch is what a raw `<a target="_blank">` on every attachment type
 * used to produce: clicking a `.py` file opened a new tab, the browser
 * silently downloaded the response into it because of the `attachment`
 * header, and the tab itself was left showing nothing — the "black screen".
 * Previewable types open a tab; everything else downloads without one.
 */
export function isPreviewableMime(mimetype: string | null | undefined): boolean {
  if (!mimetype) return false;
  return (
    mimetype.startsWith('image/') ||
    mimetype === 'application/pdf' ||
    mimetype.startsWith('video/') ||
    mimetype.startsWith('audio/')
  );
}

/**
 * Triggers a direct download of `url` with no intervening blank tab. Used for
 * every attachment type the browser can't preview in place — see
 * `isPreviewableMime`. The `download` attribute is a hint only (the response
 * already carries its own `Content-Disposition: attachment` and real
 * filename); it mainly helps same-origin `blob:`/`data:` URLs, which have no
 * filename of their own.
 */
export function downloadAttachment(url: string, filename?: string): void {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
