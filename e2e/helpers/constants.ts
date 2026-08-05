/**
 * DevSync E2E Test Constants
 * Central configuration for test URLs, credentials, and test data references.
 */

// ─── Server URLs ────────────────────────────────────────────────────────────
export const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
export const API_URL = process.env.API_URL || 'http://localhost:3001/api';

// ─── Test Workspace & Project ───────────────────────────────────────────────
export const TEST_WORKSPACE = {
  name: 'E2E Test Workspace',
  slug: 'e2e-test-workspace',
};

export const TEST_PROJECT = {
  name: 'E2E Test Project',
  key: 'E2E',
};

/** Secondary project — used for cross-project isolation tests */
export const TEST_PROJECT_2 = {
  name: 'Security Project',
  key: 'SEC',
};

// ─── Global Test Password ───────────────────────────────────────────────────
export const TEST_PASSWORD = 'password123';

// ─── Test Users (role assignments set up by the seed script) ────────────────
export const TEST_USERS = {
  /** Workspace: owner | Project: project_admin (implicit via workspace role) */
  owner: {
    email: 'alice@demo.com',
    name: 'Alice Carter',
    password: TEST_PASSWORD,
  },
  /** Workspace: admin | Project: project_admin (implicit via workspace role) */
  admin: {
    email: 'bob@demo.com',
    name: 'Bob Sharma',
    password: TEST_PASSWORD,
  },
  /** Workspace: member | Project: project_admin (explicit) */
  projectAdmin: {
    email: 'carol@demo.com',
    name: 'Carol Nguyen',
    password: TEST_PASSWORD,
  },
  /** Workspace: member | Project: developer */
  developer: {
    email: 'dave@demo.com',
    name: 'Dave Patel',
    password: TEST_PASSWORD,
  },
  /** Workspace: member | Project: viewer */
  viewer: {
    email: 'eve@demo.com',
    name: 'Eve Robinson',
    password: TEST_PASSWORD,
  },
  /** Not a member of the test workspace at all */
  outsider: {
    email: 'frank@demo.com',
    name: 'Frank Liu',
    password: TEST_PASSWORD,
  },
  /** Workspace: member | Project E2E: NONE | Project SEC: developer
   *  Used to test cross-project isolation (has role in SEC but not E2E) */
  crossProject: {
    email: 'grace@demo.com',
    name: 'Grace Kim',
    password: TEST_PASSWORD,
  },
  /** Workspace: member | Project E2E: NONE | No project roles at all
   *  Tests that workspace membership alone doesn't grant project access */
  memberNoProject: {
    email: 'hank@demo.com',
    name: 'Hank Torres',
    password: TEST_PASSWORD,
  },
} as const;

// ─── Auth State Paths ───────────────────────────────────────────────────────
export const AUTH_STATE_DIR = '.auth';
export const authStatePath = (role: string) => `${AUTH_STATE_DIR}/${role}.json`;

// ─── Commonly Used Routes ───────────────────────────────────────────────────
export const ROUTES = {
  landing: '/',
  login: '/login',
  register: '/register',
  workspaces: '/workspaces',
  workspace: (slug: string) => `/w/${slug}`,
  workspaceMembers: (slug: string) => `/w/${slug}/members`,
  workspaceSettings: (slug: string) => `/w/${slug}/settings`,
  projects: (slug: string) => `/w/${slug}/projects`,
  projectBoard: (slug: string, key: string) => `/w/${slug}/projects/${key}`,
  projectBacklog: (slug: string, key: string) => `/w/${slug}/projects/${key}/backlog`,
  projectSprints: (slug: string, key: string) => `/w/${slug}/projects/${key}/sprints`,
  projectMembers: (slug: string, key: string) => `/w/${slug}/projects/${key}/members`,
  projectSettings: (slug: string, key: string) => `/w/${slug}/projects/${key}/settings`,
  projectGithub: (slug: string, key: string) => `/w/${slug}/projects/${key}/github`,
  channels: (slug: string) => `/w/${slug}/channels`,
  notifications: (slug: string) => `/w/${slug}/notifications`,
  search: (slug: string) => `/w/${slug}/search`,
} as const;
