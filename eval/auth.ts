import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET not found in environment');
}

export function mintEvalToken(user: { userId: string; email: string }): string {
  return jwt.sign(
    { userId: user.userId, email: user.email },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '24h' }
  );
}
