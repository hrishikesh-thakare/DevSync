import { z } from 'zod';

const LabelName = z.string().trim().min(1, 'Label name is required').max(50, 'Label name must be 50 characters or less');
const LabelColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #ff0000');

export const createLabelSchema = z.object({
  name: LabelName,
  color: LabelColor.optional(),
}).strict();

export const updateLabelSchema = z.object({
  name: LabelName.optional(),
  color: LabelColor.optional(),
}).strict();