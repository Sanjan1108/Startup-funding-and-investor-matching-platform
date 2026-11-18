import { Router, Response } from 'express';
import { pool, mongoDb } from '../lib/db';
import { logActivity } from '../lib/audit';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/pitch-decks
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT p.deck_id, p.startup_id, p.title, p.file_url, p.description, p.uploaded_at, s.startup_name FROM pitch_deck p JOIN startup s ON s.startup_id=p.startup_id ORDER BY p.uploaded_at DESC'
    );
    return res.json(rows);
  } catch (error) {
    console.error('Error fetching pitch decks:', error);
    return res.status(500).json({ error: 'Failed to retrieve pitch decks.' });
  }
});

// GET /api/pitch-decks/search?q=term
router.get('/search', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);

  try {
    const db = await mongoDb();
    const words = q.toLowerCase().split(/\W+/).filter(Boolean);
    const docs = await db.collection('pitch_deck_content').find(
      { $or: [{ deck_text: { $regex: q, $options: 'i' } }, { keywords: { $in: words } }] },
      { projection: { _id: 0, deck_id: 1, startup_id: 1, title: 1, deck_text: 1 } }
    ).limit(20).toArray();

    return res.json(docs);
  } catch (e) {
    console.error('MongoDB search error:', e);
    return res.status(500).json({ error: 'MongoDB search failed.' });
  }
});

// POST /api/pitch-decks
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const u = req.user!;

  try {
    const { startup_id, title, file_url, description = '', deck_text = '' } = req.body || {};

    if (!startup_id || !title || !file_url) {
      return res.status(400).json({ error: 'Startup, title and file URL are required.' });
    }

    const [r]: any = await pool.execute(
      'INSERT INTO pitch_deck (startup_id, title, file_url, description) VALUES (?, ?, ?, ?)',
      [startup_id, title, file_url, description]
    );

    try {
      const db = await mongoDb();
      await db.collection('pitch_deck_content').insertOne({
        deck_id: r.insertId,
        startup_id: Number(startup_id),
        title,
        deck_text,
        keywords: deck_text.toLowerCase().split(/\W+/).filter(Boolean).slice(0, 500),
        createdAt: new Date()
      });
    } catch (mErr) {
      console.warn('MongoDB pitch deck content write skipped/failed:', mErr);
    }

    logActivity('pitch_deck_added', { deck_id: r.insertId, user_id: u.user_id });
    return res.status(201).json({ ok: true, id: r.insertId });

  } catch (e) {
    console.error('Error saving pitch deck:', e);
    return res.status(400).json({ error: 'Could not save pitch deck.' });
  }
});

export default router;
