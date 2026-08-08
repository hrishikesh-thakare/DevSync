import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireWorkspaceRole } from '../../middleware/roles.js';
import { uploadFile, getUploadUrl, getDownloadUrl, getRawFile } from './files.controller.js';

// Mounted at: /api/workspaces/:slug/files
const router = Router({ mergeParams: true });

// Raw file streaming (unauthenticated / UUID lookup for browser navigation)
router.get('/:fileId/raw', getRawFile);

router.use(requireAuth);
router.use(requireWorkspaceRole(['owner', 'admin', 'member']));

// New: direct server-side upload (base64 in JSON body)
router.post('/upload', uploadFile);

// Legacy: presigned upload URL
router.post('/upload-url', getUploadUrl);

// Download
router.get('/:fileId/download', getDownloadUrl);

export default router;
