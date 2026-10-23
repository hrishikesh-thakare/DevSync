import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure backend .env is read
const backendEnvPath = path.resolve(__dirname, '../backend/.env');
dotenv.config({ path: backendEnvPath });

const baseDbUrl = process.env.DATABASE_URL!;
const evalDbUrl = baseDbUrl.replace(/\/postgres(\?.*)?$/, '/devsync_eval$1');

// Configure environment for eval server
process.env.DATABASE_URL = evalDbUrl;
process.env.PORT = process.env.EVAL_PORT || '3099';
process.env.NODE_ENV = 'test';

console.log(`[EvalServer] Starting server with test db: ${evalDbUrl.split('@')[1] || 'devsync_eval'}`);
console.log(`[EvalServer] Port: ${process.env.PORT}`);

// Dynamically import backend server entrypoint
import { pathToFileURL } from 'url';
const serverPath = path.resolve(__dirname, '../backend/src/index.ts');
await import(pathToFileURL(serverPath).href);
