import { Router, Response } from 'express';
import { pool } from '../lib/db';
import { logActivity } from '../lib/audit';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/preferences
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const u = req.user!;

  if (u.role !== 'INVESTOR' && u.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only investors can access investment preferences.' });
  }

  try {
    const [rows] = await pool.query<any[]>(
      `SELECT p.*, ind.industry_name
       FROM investor_preferences p
       JOIN investor iv ON iv.investor_id = p.investor_id
       LEFT JOIN industry ind ON ind.industry_id = p.industry_id
       WHERE iv.user_id = ?`,
      [u.user_id]
    );

    return res.json(rows);
  } catch (error) {
    console.error('Preferences GET error:', error);
    return res.status(500).json({ error: 'Could not load preferences.' });
  }
});

// POST /api/preferences
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const u = req.user!;

  if (u.role !== 'INVESTOR' && u.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only investors can manage investment preferences.' });
  }

  try {
    const body = req.body || {};
    const industryId = body.industry_id ? Number(body.industry_id) : null;
    const preferredStage = body.preferred_stage ? String(body.preferred_stage) : null;
    const minTicket = body.min_ticket !== undefined && body.min_ticket !== '' ? Number(body.min_ticket) : null;
    const maxTicket = body.max_ticket !== undefined && body.max_ticket !== '' ? Number(body.max_ticket) : null;

    if (minTicket !== null && maxTicket !== null && minTicket > maxTicket) {
      return res.status(400).json({ error: 'Minimum ticket cannot exceed maximum ticket.' });
    }

    // Check if investor profile exists for this user
    let investorId: number;
    const [inv] = await pool.query<any[]>(
      'SELECT investor_id FROM investor WHERE user_id = ? LIMIT 1',
      [u.user_id]
    );

    if (!inv.length) {
      const firmName = u.name ? `${u.name}'s Ventures` : 'Angel Portfolio';
      const [newInv]: any = await pool.execute(
        `INSERT INTO investor (user_id, investor_type, firm_name, location)
         VALUES (?, 'Angel Investor', ?, 'India')`,
        [u.user_id, firmName]
      );
      investorId = newInv.insertId;
    } else {
      investorId = inv[0].investor_id;
    }

    await pool.execute(
      `INSERT INTO investor_preferences (investor_id, industry_id, preferred_stage, min_ticket, max_ticket)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         industry_id = VALUES(industry_id),
         preferred_stage = VALUES(preferred_stage),
         min_ticket = VALUES(min_ticket),
         max_ticket = VALUES(max_ticket)`,
      [investorId, industryId, preferredStage, minTicket, maxTicket]
    );

    logActivity('investor_preferences_updated', {
      investor_id: investorId,
      user_id: u.user_id,
      industryId,
      preferredStage
    });

    return res.json({
      ok: true,
      message: 'Investor preferences saved successfully!'
    });

  } catch (error: any) {
    console.error('Preferences save error:', error);
    return res.status(400).json({
      error: 'Could not save preferences. Please check ticket range.'
    });
  }
});

export default router;
