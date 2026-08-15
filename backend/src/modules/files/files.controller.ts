import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { workspaceFiles } from '../../db/schema/channels.js';
import { eq } from 'drizzle-orm';
import { supabase } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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

    const safeName = filename.replace(/[^a-zA-Z0-9-_\.]/g, '');
    const uniqueName = `${Date.now()}_${safeName}`;
    const storagePath = `workspaces/${workspaceId}/${uniqueName}`;
    const fileBuffer = Buffer.from(fileBase64, 'base64');

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
      // Local disk fallback
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
        filename,
        storagePath: finalStoragePath,
        mimetype: mimetype || null,
        sizeBytes: sizeBytes || null,
        filetype: filetype || 'other',
      })
      .returning();

    res.status(200).json({ fileRecord });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Server error uploading file.' });
  }
};

// ─── LEGACY: GET PRESIGNED UPLOAD URL ────────────────────────────────────────
export const getUploadUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.params as Record<string, string>;
    const userId = req.user!.userId;
    const { filename, mimetype, sizeBytes, filetype } = req.body;

    if (!filename) {
      res.status(400).json({ error: 'Filename is required.' });
      return;
    }

    const safeName = filename.replace(/[^a-zA-Z0-9-_\.]/g, '');
    const storagePath = `workspaces/${workspaceId}/${Date.now()}_${safeName}`;

    const [fileRecord] = await db
      .insert(workspaceFiles)
      .values({
        workspaceId,
        uploaderId: userId,
        filename,
        storagePath,
        mimetype: mimetype || null,
        sizeBytes: sizeBytes || null,
        filetype: filetype || 'other',
      })
      .returning();

    const { data, error } = await supabase.storage
      .from('workspace-files')
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.warn('Supabase presigned upload error:', error.message);
      res.status(200).json({ uploadUrl: null, fileRecord });
      return;
    }

    res.status(200).json({ uploadUrl: data.signedUrl, fileRecord });
  } catch (err) {
    console.error('Get upload URL error:', err);
    res.status(500).json({ error: 'Server error generating upload URL.' });
  }
};

// ─── GET DOWNLOAD URL ────────────────────────────────────────────────────────
// GET /api/workspaces/:workspaceId/files/:fileId/download
export const getDownloadUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params as Record<string, string>;

    const [fileRecord] = await db
      .select()
      .from(workspaceFiles)
      .where(eq(workspaceFiles.fileId, fileId))
      .limit(1);

    if (!fileRecord) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }

    // If local file, return raw endpoint URL
    if (fileRecord.storagePath.startsWith('local:')) {
      const token = jwt.sign({ fileId: fileRecord.fileId }, env.JWT_SECRET, { expiresIn: '1h' });
      const rawUrl = `${env.BACKEND_URL || 'http://localhost:3001'}/api/workspaces/${fileRecord.workspaceId}/files/${fileRecord.fileId}/raw?token=${token}`;
      res.json({ downloadUrl: rawUrl, fileRecord });
      return;
    }

    // Try Supabase signed URL
    if (env.SUPABASE_URL && !env.SUPABASE_URL.includes('placeholder')) {
      const { data, error } = await supabase.storage
        .from('workspace-files')
        .createSignedUrl(fileRecord.storagePath, 3600);

      if (!error && data?.signedUrl) {
        res.json({ downloadUrl: data.signedUrl, fileRecord });
        return;
      }
    }

    // Fallback: raw endpoint
    const token = jwt.sign({ fileId: fileRecord.fileId }, env.JWT_SECRET, { expiresIn: '1h' });
    const rawUrl = `${env.BACKEND_URL || 'http://localhost:3001'}/api/workspaces/${fileRecord.workspaceId}/files/${fileRecord.fileId}/raw?token=${token}`;
    res.json({ downloadUrl: rawUrl, fileRecord });
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
        res.setHeader('Content-Type', fileRecord.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${fileRecord.filename}"`);
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

    res.setHeader('Content-Type', fileRecord.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${fileRecord.filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Get raw file error:', err);
    res.status(500).send('Server error serving file.');
  }
};
