import { z } from 'zod';

// GitHub repo names max out at 100 chars, usernames at 39.
export const connectGithubSchema = z.object({
  repo_owner: z.string().min(1, 'Repository owner is required').max(100),
  repo_name: z.string().min(1, 'Repository name is required').max(100),
}).strict();

// GitHub caps issue/PR comments at 65,536 chars.
const GithubCommentBody = z
  .string({ required_error: 'Comment body must be a string' })
  .min(1, 'Comment cannot be empty')
  .max(65536, 'Comment must be 65,536 characters or less');

export const addGithubCommentSchema = z.object({
  body: GithubCommentBody,
}).strict();

// GitHub caps PR titles at 256 chars, branch names at 255.
const GithubBranchName = z.string().min(1, 'Branch name is required').max(255, 'Branch name must be 255 characters or less');

export const createPullRequestSchema = z.object({
  title: z.string().min(1, 'PR title is required').max(256, 'PR title must be 256 characters or less'),
  body: z.string().max(65536, 'PR body must be 65,536 characters or less').nullable().optional(),
  head: GithubBranchName,
  base: GithubBranchName,
  taskId: z.string().uuid('Invalid task ID format').nullable().optional(),
}).strict();

export const createBranchSchema = z.object({
  branchName: GithubBranchName,
  baseBranch: GithubBranchName,
  taskId: z.string().uuid('Invalid task ID format').nullable().optional(),
}).strict();

// GitHub OAuth authorization codes are short-lived, opaque strings.
export const exchangeGithubCodeSchema = z.object({
  providerToken: z.string().min(1, 'Authorization code is required').max(2000),
}).strict();