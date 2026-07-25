import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { workspaceFiles } from '../../db/schema/channels.js';
import { eq } from 'drizzle-orm';
import { supabase } from '../../config/supabase.js';

// ─── DIRECT FILE UPLOAD (Server-side) ────────────────────────────────────────
// POST /api/workspaces/:workspaceId/files/upload
// Accepts: { filename, mimetype, sizeBytes, filetype, fileBase64 }
// The frontend sends the file as a base64 string. The backend uploads it
// directly to Supabase Storage using the service_role key (bypasses RLS).
export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.params as Record<string, string>;
    const userId = req.user!.userId;
    const { filename, mimetype, sizeBytes, filetype, fileBase64 } = req.body;

    if (!filename || !fileBase64) {
      res.status(400).json({ error: 'filename and fileBase64 are required.' });
      return;
    }

    // Define unique path in storage bucket
    const safeName = filename.replace(/[^a-zA-Z0-9-_\.]/g, '');
    const storagePath = `workspaces/${workspaceId}/${Date.now()}_${safeName}`;

    // Decode base64 to Buffer
    const fileBuffer = Buffer.from(fileBase64, 'base64');

    // Upload directly to Supabase Storage using service role
    const { error: uploadError } = await supabase.storage
      .from('workspace-files')
      .upload(storagePath, fileBuffer, {
        contentType: mimetype || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError.message);
      res.status(500).json({ error: `Storage upload failed: ${uploadError.message}` });
      return;
    }

    // Create record in DB
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

    res.status(200).json({ fileRecord });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Server error uploading file.' });
  }
};

// ─── LEGACY: GET PRESIGNED UPLOAD URL (kept for backward compat) ─────────────
// POST /api/workspaces/:workspaceId/files/upload-url
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

    // Try signed URL first (works for private buckets with service role)
    const { data, error } = await supabase.storage
      .from('workspace-files')
      .createSignedUrl(fileRecord.storagePath, 3600); // 1 hour expiry

    if (!error && data?.signedUrl) {
      res.json({ downloadUrl: data.signedUrl, fileRecord });
      return;
    }

    // Fallback: try public URL
    const { data: publicData } = supabase.storage
      .from('workspace-files')
      .getPublicUrl(fileRecord.storagePath);

    res.json({ downloadUrl: publicData.publicUrl, fileRecord });
  } catch (err) {
    console.error('Get download URL error:', err);
    res.status(500).json({ error: 'Server error generating download URL.' });
  }
};
