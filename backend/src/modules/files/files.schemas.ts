import { z } from 'zod';

// Matches the enum the other upload paths already use.
const FiletypeEnum = z.enum(['image', 'pdf', 'code', 'video', 'audio', 'other']);

// 25 MiB of bytes is roughly 34 MB of base64 (4 chars per 3 bytes, plus
// padding). Rejecting on the envelope length here means an oversized upload is
// refused before it is decoded into a Buffer; `createFileRecord` then enforces
// the real limit on the decoded bytes. Both are needed — this one bounds the
// work, that one bounds the truth.
const MAX_BASE64_CHARS = 35_000_000;

export const uploadFileSchema = z.object({
  filename: z.string().min(1).max(255),
  mimetype: z.string().max(100).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  filetype: FiletypeEnum.optional(),
  fileBase64: z
    .string()
    .min(1, 'fileBase64 is required')
    .max(MAX_BASE64_CHARS, 'File is too large'),
}).strict();
