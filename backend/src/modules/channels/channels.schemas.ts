import { z } from 'zod';

const ChannelTypeEnum = z.enum(['public', 'private', 'dm', 'group_dm']);

export const createChannelSchema = z.object({
  name: z.string().min(1, 'Channel name cannot be empty').max(80).optional(),
  description: z.string().optional(),
  type: ChannelTypeEnum,
  projectId: z.string().uuid('Invalid project ID format').optional().nullable(),
  isAnnouncementOnly: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  memberIds: z.array(z.string().uuid('Invalid user ID format')).optional(),
}).strict();

export const updateChannelSchema = z.object({
  name: z.string().min(1, 'Channel name cannot be empty').max(80).optional(),
  description: z.string().optional(),
}).strict();
