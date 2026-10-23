import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend .env for credentials
const backendEnvPath = path.resolve(__dirname, '../backend/.env');
dotenv.config({ path: backendEnvPath });

const baseDbUrl = process.env.DATABASE_URL;
if (!baseDbUrl) {
  throw new Error('DATABASE_URL is not set in backend/.env');
}

export const evalDbUrl = baseDbUrl.replace(/\/postgres(\?.*)?$/, '/devsync_eval$1');

export function getEvalSql(max = 5) {
  return postgres(evalDbUrl, {
    ssl: { rejectUnauthorized: false },
    max,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

export function getAdminSql(max = 1) {
  return postgres(baseDbUrl!, {
    ssl: { rejectUnauthorized: false },
    max,
  });
}
