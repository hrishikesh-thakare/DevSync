import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
import { users } from '../../db/schema/auth.js';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '../../lib/encryption.js';

// ─── GET OAUTH URL ──────────────────────────────────────────────────────────
// GET /api/github/oauth/url
export const getGithubOauthUrl = (req: Request, res: Response) => {
  const { returnTo } = req.query;
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GitHub OAuth is not configured.' });
  }
  const redirectUri = `${env.FRONTEND_URL}/github/callback`;
  const stateStr = returnTo ? Buffer.from(JSON.stringify({ returnTo })).toString('base64') : '';
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo%20workflow%20admin:repo_hook&prompt=consent&redirect_uri=${encodeURIComponent(redirectUri)}${stateStr ? `&state=${encodeURIComponent(stateStr)}` : ''}`;
  res.json({ url });
};

// ─── OAUTH EXCHANGE ─────────────────────────────────────────────────────────
// POST /api/github/oauth/exchange
export const exchangeGithubCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { providerToken } = req.body;
    
    if (!providerToken) {
      res.status(400).json({ error: 'Provider token is required.' });
      return;
    }

    // Save token to user
    await db
      .update(users)
      .set({ githubAccessToken: encrypt(providerToken) })
      .where(eq(users.userId, userId));

    res.json({ message: 'GitHub account connected successfully.' });
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

// ─── DISCONNECT USER GITHUB ─────────────────────────────────────────────────
// DELETE /api/github/user/disconnect
export const disconnectUserGithub = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    await db.update(users).set({ githubAccessToken: null }).where(eq(users.userId, userId));
    res.json({ message: 'GitHub account disconnected successfully.' });
  } catch (error) {
    console.error('Disconnect user GitHub error:', error);
    res.status(500).json({ error: 'Server error disconnecting GitHub account.' });
  }
};
