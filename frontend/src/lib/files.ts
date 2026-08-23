/**
 * Helpers for the JSON upload path the task attachment endpoint uses.
 *
 * `POST /tasks/:taskKey/attachments` takes the whole file as base64 inside the
 * request body — there is no multipart handler — so the browser has to encode
 * it first. Express is configured with `limit: '50mb'`, and base64 inflates by
 * about a third, which is where MAX_UPLOAD_BYTES comes from.
 */

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

/**
 * Reads a File into a bare base64 string.
 *
 * `FileReader.readAsDataURL` yields `data:<mime>;base64,<payload>`; the server
 * calls `Buffer.from(fileBase64, 'base64')` directly, so the prefix has to go —
 * leaving it on corrupts the first bytes of every stored file.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
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
