import { z } from 'zod';

// GitHub repo names max out at 100 chars, usernames at 39. The charset matters
// as much as the length: these two are concatenated into `owner/name` and
// interpolated into every api.github.com URL this module builds, so a value
// containing `/` or `..` would retarget those requests at a different endpoint
// under the stored OAuth token. GitHub itself allows only alphanumerics, `-`,
// `_` and `.`, so pinning the charset costs nothing and closes that door.
const GithubPathSegment = (label: string, max: number) =>
  z
    .string()
    .min(1, `${label} is required`)
    .max(max)
    .regex(/^[A-Za-z0-9._-]+$/, `${label} contains invalid characters`)
    .refine((v) => v !== '.' && v !== '..', `${label} is not a valid path segment`);

export const connectGithubSchema = z.object({
  repo_owner: GithubPathSegment('Repository owner', 39),
  repo_name: GithubPathSegment('Repository name', 100),
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