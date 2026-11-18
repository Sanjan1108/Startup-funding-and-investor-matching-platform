import { Router, Request, Response } from 'express';
import { pool, mongoDb } from '../lib/db';

const router = Router();

// GET /api/health
router.get('/', async (req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    const db = await mongoDb();
    await db.command({ ping: 1 });
    return res.json({ mysql: 'connected', mongodb: 'connected' });
  } catch (e) {
    return res.status(503).json({
      mysql: 'check configuration',
      mongodb: 'check configuration'
    });
  }
});

export default router;
