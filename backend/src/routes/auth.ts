import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../lib/db';
import { makeToken } from '../lib/auth';
import { logActivity } from '../lib/audit';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = String(body.role || 'STARTUP').toUpperCase();

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }

    if (name.length > 100) {
      return res.status(400).json({ error: 'Name cannot exceed 100 characters.' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email) || email.length > 150) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Password must contain between 8 and 128 characters.' });
    }

    if (!['STARTUP', 'INVESTOR'].includes(role)) {
      return res.status(403).json({ error: 'Invalid account role.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result]: any = await pool.execute(
      'INSERT INTO `user` (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, role]
    );

    void logActivity('user_registered', {
      user_id: result.insertId,
      role
    });

    return res.status(201).json({
      ok: true,
      user_id: result.insertId,
      message: 'Account created successfully.'
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [rows] = await pool.query<any[]>(
      'SELECT user_id, name, email, password_hash, role FROM `user` WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = await makeToken(user);

    res.cookie('sf_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    void logActivity('user_login', {
      user_id: user.user_id
    }).catch(error => {
      console.error('Login activity logging failed:', error);
    });

    return res.json({
      ok: true,
      user: {
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Could not sign in. Please try again.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('sf_session', {
    httpOnly: true,
    path: '/'
  });
  return res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    user: {
      user_id: req.user!.user_id,
      name: req.user!.name,
      role: req.user!.role
    }
  });
});

export default router;
