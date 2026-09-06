import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
import { users } from '../../db/schema/auth.js';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '../../lib/encryption.js';

const OAUTH_STATE_PURPOSE = 'github-oauth-state';

// ─── GET OAUTH URL ──────────────────────────────────────────────────────────
// GET /api/github/oauth/url
export const getGithubOauthUrl = (req: Request, res: Response) => {
  const { returnTo } = req.query;
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GitHub OAuth is not configured.' });
  }
  const redirectUri = `${env.FRONTEND_URL}/github/callback`;

  // `state` is a short-lived, signed token — not just an opaque carrier for
  // `returnTo`. Without a signature, anyone can hand a victim's browser a
  // link straight to GitHub's authorize screen with a `state` of their own
  // choosing; if the callback trusted whatever it got back, an attacker
  // could complete a code exchange for their own GitHub account and have it
  // silently linked to the victim's DevSync session (login/account-linking
  // CSRF). Binding it to this user's id and a 10-minute expiry means the
  // callback can verify the exchange it's about to run was actually
  // initiated by the same authenticated user, recently.
  const state = jwt.sign(
    { purpose: OAUTH_STATE_PURPOSE, userId: req.user!.userId, returnTo: typeof returnTo === 'string' ? returnTo : undefined },
    env.JWT_SECRET,
    { expiresIn: '10m' },
  );

  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo%20workflow%20admin:repo_hook&prompt=consent&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  res.json({ url });
};

// ─── OAUTH EXCHANGE ─────────────────────────────────────────────────────────
// POST /api/github/oauth/exchange
//
// Takes the `code` GitHub's redirect handed back to /github/callback and
// exchanges it for a real access token server-side — this is the step that
// requires GITHUB_CLIENT_SECRET, which is why it can't happen in the browser.
// `state` must be the signed token this same user was issued by
// getGithubOauthUrl above; without that check, this endpoint would accept a
// `code` obtained via *anyone's* GitHub consent and quietly attach it to
// whichever account happens to be logged in when the callback page loads.
export const exchangeGithubCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { code, state } = req.body;

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      res.status(500).json({ error: 'GitHub OAuth is not configured.' });
      return;
    }

    let statePayload: jwt.JwtPayload;
    try {
      // Pinned to the algorithm this token is actually signed with — see the
      // matching comment in middleware/auth.ts.
      statePayload = jwt.verify(state, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    } catch {
      res.status(400).json({ error: 'This GitHub sign-in link has expired or is invalid. Please try connecting again.' });
      return;
    }
    if (statePayload.purpose !== OAUTH_STATE_PURPOSE || statePayload.userId !== userId) {
      res.status(400).json({ error: 'This GitHub sign-in link was not issued for this account.' });
      return;
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${env.FRONTEND_URL}/github/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      res.status(502).json({ error: 'GitHub did not accept this authorization code.' });
      return;
    }

    const tokenData = await tokenResponse.json() as Record<string, any>;
    if (!tokenData.access_token) {
      res.status(400).json({ error: tokenData.error_description || 'GitHub did not return an access token.' });
      return;
    }

    await db
      .update(users)
      .set({ githubAccessToken: encrypt(tokenData.access_token) })
      .where(eq(users.userId, userId));

    res.json({ message: 'GitHub account connected successfully.', returnTo: statePayload.returnTo ?? null });
  } catch (error) {
    console.error('GitHub exchange error:', error);
    res.status(500).json({ error: 'Server error saving GitHub token.' });
  }
};

// ─── GET USER REPOS ─────────────────────────────────────────────────────────
// GET /api/github/user/repos
export const getUserGithubRepos = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const [user] = await db
      .select({ githubAccessToken: users.githubAccessToken })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user || !user.githubAccessToken) {
      res.status(404).json({ error: 'GitHub account not connected.' });
      return;
    }

    const decryptedToken = decrypt(user.githubAccessToken);

    const reposResponse = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${decryptedToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (reposResponse.status === 401) {
      // Token might be revoked
      await db.update(users).set({ githubAccessToken: null }).where(eq(users.userId, userId));
      res.status(401).json({ error: 'GitHub access token expired or revoked. Please reconnect.' });
      return;
    }

    if (!reposResponse.ok) {
      res.status(reposResponse.status).json({ error: 'Failed to fetch repositories from GitHub.' });
      return;
    }

    const repos = await reposResponse.json() as any[];

    const formattedRepos = repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      private: repo.private,
      url: repo.html_url,
      defaultBranch: repo.default_branch,
    }));

    res.json({ repos: formattedRepos });
  } catch (error) {
    console.error('Get GitHub repos error:', error);
    res.status(500).json({ error: 'Server error fetching GitHub repositories.' });
  }
};

