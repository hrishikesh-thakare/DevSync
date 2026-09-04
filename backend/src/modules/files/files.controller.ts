import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { workspaceFiles } from '../../db/schema/channels.js';
import { and, eq } from 'drizzle-orm';
import { supabase } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import {
  MAX_FILE_BYTES,
  headerSafeFilename,
  isAllowedUploadMime,
  normalizeMime,
  serveDisposition,
} from '../../lib/fileTypes.js';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Raised when an upload fails validation, so callers can answer 400 rather than
 * the generic 500 an unexpected throw would produce.
 */
export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * Stores a file (Supabase Storage with local disk fallback) and creates its
 * workspace_files record. Used by the generic file upload, by task
 * attachment uploads, and by avatar uploads (`workspaceId: null` — the
 * column is nullable for exactly this: a personal file with no workspace
 * home, stored under `users/<userId>/` instead of `workspaces/<id>/`).
 */
export const createFileRecord = async (params: {
  workspaceId: string | null;
  userId: string;
  filename: string;
  mimetype?: string;
  sizeBytes?: number;
  filetype?: string;
  fileBase64: string;
  taskId?: string;
}): Promise<typeof workspaceFiles.$inferSelect> => {
  const { workspaceId, userId, filename, mimetype, filetype, fileBase64, taskId } = params;

  const safeName = filename.replace(/[^a-zA-Z0-9-_\.]/g, '');
  const uniqueName = `${Date.now()}_${safeName}`;
  const storagePath = workspaceId ? `workspaces/${workspaceId}/${uniqueName}` : `users/${userId}/${uniqueName}`;
  const fileBuffer = Buffer.from(fileBase64, 'base64');

  // Every upload path — generic files, task attachments, avatars — funnels
  // through here, so this is the one place worth validating. `mimetype` and
  // `sizeBytes` arrive as client assertions; neither was previously checked
  // against the bytes actually sent.
  if (fileBuffer.length === 0) {
    throw new FileValidationError('File is empty or not valid base64.');
  }

  if (fileBuffer.length > MAX_FILE_BYTES) {
    throw new FileValidationError(
      `File exceeds the ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB limit.`,
    );
  }

  if (!isAllowedUploadMime(mimetype)) {
    throw new FileValidationError(`Files of type "${normalizeMime(mimetype) || 'unknown'}" are not allowed.`);
  }

  // The stored size is the measured one. A client-supplied `sizeBytes` that
  // disagrees is not an error worth rejecting, it is just not authoritative.
  const measuredBytes = fileBuffer.length;

  let isSupabaseUploaded = false;

  // Try Supabase Storage if configured
  if (env.SUPABASE_URL && !env.SUPABASE_URL.includes('placeholder')) {
    const { error: uploadError } = await supabase.storage
      .from('workspace-files')
      .upload(storagePath, fileBuffer, {
        contentType: mimetype || 'application/octet-stream',
        upsert: false,
      });

    if (!uploadError) {
      isSupabaseUploaded = true;
    } else {
      console.warn('Supabase upload failed, using local disk fallback:', uploadError.message);
    }
  }

  let finalStoragePath = storagePath;
  if (!isSupabaseUploaded) {
    // The local disk fallback is a development convenience, and on a managed
    // host it is actively harmful: the container filesystem is ephemeral, so
    // the bytes are gone at the next restart or redeploy while the
    // workspace_files row survives, pointing at a file that no longer exists.
    // The user is told the upload succeeded and finds it broken days later.
    // Fail the request instead — a visible error is recoverable, silent data
    // loss is not.
    if (env.NODE_ENV === 'production') {
      throw new Error(
        'File storage is unavailable: the Supabase upload failed and the local disk ' +
          'fallback is disabled in production because container storage is ephemeral.'
      );
    }
    const localFilePath = path.join(UPLOADS_DIR, uniqueName);
    fs.writeFileSync(localFilePath, fileBuffer);
    finalStoragePath = `local:${uniqueName}`;
  }

  // Create record in DB
  const [fileRecord] = await db
    .insert(workspaceFiles)
    .values({
      workspaceId,
      uploaderId: userId,
      taskId: taskId || null,
      filename,
      storagePath: finalStoragePath,
      mimetype: mimetype || null,
      sizeBytes: measuredBytes,
      filetype: filetype || 'other',
    })
    .returning();

  return fileRecord;
};

/**
 * Response headers for a stored file.
 *
 * The uploader's declared mimetype is never echoed straight back. It used to
 * be, alongside `Content-Disposition: inline`, which meant an uploaded
 * `text/html` became a permanent script-hosting URL on the API's own origin —
 * stored XSS against every session that opened it. `serveDisposition` maps the
 * type through an allowlist instead: renderable types keep their type and go
 * inline, everything else becomes an octet-stream download.
 *
 * `nosniff` and the sandbox CSP are the belt to that braces. Even if a type
 * slips through, the browser will not re-sniff it into something executable,
 * and the CSP denies scripts in the document regardless.
 */
const applyServingHeaders = (res: Response, mimetype: string | null, filename: string): void => {
  const { contentType, disposition } = serveDisposition(mimetype);
  res.setHeader('Content-Type', contentType);
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${headerSafeFilename(filename)}"`,
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
};

// ─── DIRECT FILE UPLOAD (Server-side) ────────────────────────────────────────
// POST /api/workspaces/:workspaceId/files/upload
export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.params as Record<string, string>;
    const userId = req.user!.userId;
    const { filename, mimetype, sizeBytes, filetype, fileBase64 } = req.body;

    if (!filename || !fileBase64) {
      res.status(400).json({ error: 'filename and fileBase64 are required.' });
      return;
    }

    const fileRecord = await createFileRecord({
      workspaceId,
      userId,
      filename,
      mimetype,
      sizeBytes,
      filetype,
      fileBase64,
    });

    res.status(200).json({ fileRecord });
  } catch (err) {
    // A rejected upload is the caller's fault, not the server's.
    if (err instanceof FileValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Server error uploading file.' });
  }
};


/**
 * A signed URL/JWT good for ten years — effectively permanent for a link that
 * gets stored once and displayed forever (a chat attachment in `bodyBlocks`,
 * an avatar), as opposed to the default one-hour link `TaskAttachments.tsx`
 * fetches fresh on every click. `workspace-files` is a private bucket
 * (confirmed against the actual Supabase project, not assumed), so
 * `getPublicUrl()` never works there — a long-lived signed URL, generated
 * once at upload time and stored, is the same shape of URL either way, it
 * just doesn't expire out from under content nothing ever re-signs.
 */
const PERSISTENT_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 365 * 10;
const PERSISTENT_JWT_EXPIRES_IN = '3650d';

/**
 * The actual URL-resolution logic behind `getDownloadUrl`, pulled out so a
 * non-HTTP caller (the avatar upload handler, which wants a URL back in the
 * same request that created the file, not a second round trip through a
 * workspace-scoped route an avatar has no workspace to satisfy) can reuse it
 * directly instead of duplicating the local/Supabase/fallback branching.
 */
export async function resolveDownloadUrl(
  fileRecord: typeof workspaceFiles.$inferSelect,
  persistent: boolean,
): Promise<string> {
  const expiresInSeconds = persistent ? PERSISTENT_EXPIRES_IN_SECONDS : 3600;
  const jwtExpiresIn = persistent ? PERSISTENT_JWT_EXPIRES_IN : '1h';
  // Not every file has a workspace (an avatar doesn't) — `/raw` doesn't
  // actually check this path segment (see the route comment below), so a
  // placeholder is fine where a real id isn't available.
  const workspaceSegment = fileRecord.workspaceId || '_';

  if (fileRecord.storagePath.startsWith('local:')) {
    const token = jwt.sign({ fileId: fileRecord.fileId }, env.JWT_SECRET, { expiresIn: jwtExpiresIn });
    return `${env.BACKEND_URL || 'http://localhost:3001'}/api/workspaces/${workspaceSegment}/files/${fileRecord.fileId}/raw?token=${token}`;
  }

  if (env.SUPABASE_URL && !env.SUPABASE_URL.includes('placeholder')) {
    const { data, error } = await supabase.storage
      .from('workspace-files')
      .createSignedUrl(fileRecord.storagePath, expiresInSeconds);

    if (!error && data?.signedUrl) return data.signedUrl;
  }

  const token = jwt.sign({ fileId: fileRecord.fileId }, env.JWT_SECRET, { expiresIn: jwtExpiresIn });
  return `${env.BACKEND_URL || 'http://localhost:3001'}/api/workspaces/${workspaceSegment}/files/${fileRecord.fileId}/raw?token=${token}`;
}

// ─── GET DOWNLOAD URL ────────────────────────────────────────────────────────
// GET /api/workspaces/:workspaceId/files/:fileId/download?persistent=true
export const getDownloadUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params as Record<string, string>;
    const workspaceId = (req.params.workspaceId || res.locals.workspaceId) as string;
    const persistent = req.query.persistent === 'true';

    // Scope the lookup to the workspace in the URL. `requireWorkspaceRole` only
    // proves the caller belongs to *that* workspace — it says nothing about
    // where the file lives. Looking up by fileId alone let any authenticated
    // user read any file in the system by passing someone else's fileId
    // through a workspace of their own.
    const [fileRecord] = await db
      .select()
      .from(workspaceFiles)
      .where(and(eq(workspaceFiles.fileId, fileId), eq(workspaceFiles.workspaceId, workspaceId)))
      .limit(1);

    if (!fileRecord) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }

    const downloadUrl = await resolveDownloadUrl(fileRecord, persistent);
    res.json({ downloadUrl, fileRecord });
  } catch (err) {
    console.error('Get download URL error:', err);
    res.status(500).json({ error: 'Server error generating download URL.' });
  }
};

// ─── STREAM RAW FILE ─────────────────────────────────────────────────────────
// GET /api/workspaces/:workspaceId/files/:fileId/raw
export const getRawFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params as Record<string, string>;
    const { token } = req.query;

    if (!token) {
      console.warn('[getRawFile] 401: Missing access token. URL:', req.originalUrl);
      res.status(401).send('Unauthorized: Missing access token.');
      return;
    }

    try {
      const decoded = jwt.verify(token as string, env.JWT_SECRET) as { fileId: string };
      if (decoded.fileId !== fileId) {
        res.status(403).send('Forbidden: Invalid token for this file.');
        return;
      }
    } catch (err) {
      console.warn('[getRawFile] 401: JWT verify failed. fileId:', fileId, 'token length:', String(token).length, 'error:', (err as Error).message);
      res.status(401).send('Unauthorized: Invalid or expired token.');
      return;
    }

    const [fileRecord] = await db
      .select()
      .from(workspaceFiles)
      .where(eq(workspaceFiles.fileId, fileId))
      .limit(1);

    if (!fileRecord) {
      res.status(404).send('File not found.');
      return;
    }

    if (fileRecord.storagePath.startsWith('local:')) {
      const fileNameOnDisk = fileRecord.storagePath.replace('local:', '');
      const filePath = path.join(UPLOADS_DIR, fileNameOnDisk);

      if (fs.existsSync(filePath)) {
        applyServingHeaders(res, fileRecord.mimetype, fileRecord.filename);
        res.sendFile(filePath);
        return;
      }
    }

    // If stored in Supabase, download buffer from Supabase and stream
    const { data, error } = await supabase.storage
      .from('workspace-files')
      .download(fileRecord.storagePath);

    if (error || !data) {
      res.status(404).send('File missing in storage.');
      return;
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    applyServingHeaders(res, fileRecord.mimetype, fileRecord.filename);
    res.send(buffer);
  } catch (err) {
    console.error('Get raw file error:', err);
    res.status(500).send('Server error serving file.');
  }
};
