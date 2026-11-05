import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = new TextEncoder().encode(
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
    .sign(secret);
}

export async function currentUser() {
  const cookieStore = await cookies();

  const token = cookieStore.get('sf_session')?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret);

    return {
      user_id: Number(payload.sub),
      name: String(payload.name),
      role: String(payload.role),
    };
  } catch {
    return null;
  }
}