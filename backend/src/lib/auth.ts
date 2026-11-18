import dotenv from 'dotenv';
import path from 'path';

// Load .env whether running from repository root or backend folder
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

import { SignJWT, jwtVerify } from 'jose';

const getSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || 'development_secret_change_this_32_chars'
  );

export async function makeToken(user: {
  user_id: number;
  name: string;
  role: string;
}) {
  return new SignJWT({
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.user_id))
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function currentUserFromToken(token: string) {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());

    return {
      user_id: Number(payload.sub),
      name: String(payload.name),
      role: String(payload.role),
    };
  } catch {
    return null;
  }
}
