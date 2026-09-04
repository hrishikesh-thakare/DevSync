import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction): void => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    res.status(500).json({ error: 'Internal server error during validation' });
  }
};

/**
 * Rejects a path parameter that is not a plain positive integer.
 *
 * These params are interpolated into GitHub API URLs. `fetch` normalises `..`
 * segments before sending, so an unvalidated `runId` of `../../../../user/repos`
 * silently retargets the request at a different endpoint — executed with the
 * *connecting user's* stored OAuth token (scopes `repo workflow admin:repo_hook`),
 * not the caller's. Validating the shape at the router boundary is what keeps
 * the URL template a template.
 */
export const numericParam =
  (name: string) =>
  (_req: Request, res: Response, next: NextFunction, value: string): void => {
    if (typeof value !== 'string' || !/^[0-9]{1,19}$/.test(value)) {
      res.status(400).json({ error: `Invalid ${name}.` });
      return;
    }
    next();
  };
