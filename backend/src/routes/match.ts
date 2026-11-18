import { Router, Response } from 'express';
import { pool } from '../lib/db';
import { logActivity } from '../lib/audit';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

function formatMatchBreakdown(rows: any[]) {
  return rows.map((r) => {
    const breakdown = {
      base: 35,
      industry: 0,
      stage: 0,
      ticket: 0
    };

    const reasons: string[] = [];

    // Industry compatibility
    if (r.preferred_industry_id == null) {
      breakdown.industry = 25;
      reasons.push('Broad sector appetite: You are industry-agnostic.');
    } else if (Number(r.preferred_industry_id) === Number(r.industry_id)) {
      breakdown.industry = 35;
      reasons.push('Direct industry alignment with your target sector.');
    } else {
      breakdown.industry = 8;
      reasons.push('Cross-sector startup with high growth potential.');
    }

    // Funding stage compatibility
    if (!r.preferred_stage) {
      breakdown.stage = 20;
      reasons.push('Flexible stage focus: Accepts all investment stages.');
    } else if (r.preferred_stage === r.funding_stage) {
      breakdown.stage = 25;
      reasons.push('Direct funding stage alignment with your preference.');
    } else {
      breakdown.stage = 10;
      reasons.push('Startup is currently in an adjacent funding stage.');
    }

    // Investment ticket compatibility
    const amount = Number(r.amount_required);
    if (
      r.min_ticket != null &&
      r.max_ticket != null &&
      amount > 0 &&
      amount >= Number(r.min_ticket) &&
      amount <= Number(r.max_ticket)
    ) {
      breakdown.ticket = 15;
      reasons.push('Funding requirement is strictly within your ticket range.');
    } else if (r.min_ticket == null && r.max_ticket == null) {
      breakdown.ticket = 10;
      reasons.push('Flexible ticket size: No ticket constraints applied.');
    } else if (
      r.min_ticket != null &&
      r.max_ticket != null &&
      amount >= Number(r.min_ticket) * 0.7 &&
      amount <= Number(r.max_ticket) * 1.3
    ) {
      breakdown.ticket = 8;
      reasons.push('Funding requirement is within 30% of your ticket range.');
    } else {
      breakdown.ticket = 3;
      reasons.push('Funding requirement differs from your specified ticket size.');
    }

    return {
      ...r,
      breakdown,
      reasons
    };
  });
}

const baseQuery = `
  SELECT
    m.match_id,
    m.startup_id,
    m.investor_id,
    s.startup_name,
    s.industry_id,
    s.funding_stage,
    i.firm_name,
    i.user_id AS investor_user_id,
    s.user_id AS startup_user_id,
    m.match_score,
    m.status,
    m.matched_date,
    COALESCE(
      (
        SELECT fr.round_id
        FROM funding_round fr
        WHERE fr.startup_id = s.startup_id
        ORDER BY (fr.status = 'OPEN') DESC, fr.round_id DESC
        LIMIT 1
      ),
      NULL
    ) AS round_id,
    COALESCE(
      (
        SELECT fr.round_name
        FROM funding_round fr
        WHERE fr.startup_id = s.startup_id
        ORDER BY (fr.status = 'OPEN') DESC, fr.round_id DESC
        LIMIT 1
      ),
      'Seed Round'
    ) AS round_name,
    COALESCE(
      (
        SELECT fr.amount_required
        FROM funding_round fr
        WHERE fr.startup_id = s.startup_id
        ORDER BY (fr.status = 'OPEN') DESC, fr.round_id DESC
        LIMIT 1
      ),
      0
    ) AS amount_required,
    ip.industry_id AS preferred_industry_id,
    ip.preferred_stage,
    ip.min_ticket,
    ip.max_ticket
  FROM match_result m
  INNER JOIN startup s ON s.startup_id = m.startup_id
  INNER JOIN investor i ON i.investor_id = m.investor_id
  LEFT JOIN investor_preferences ip ON ip.investor_id = i.investor_id
`;

// GET /api/match
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const u = req.user!;

  try {
    if (u.role === 'INVESTOR') {
      const [prefCheck] = await pool.query<any[]>(
        `SELECT ip.preference_id
         FROM investor_preferences ip
         JOIN investor i ON i.investor_id = ip.investor_id
         WHERE i.user_id = ?
         LIMIT 1`,
        [u.user_id]
      );

      if (!prefCheck.length) {
        return res.json({
          hasPreferences: false,
          role: 'INVESTOR',
          matches: [],
          message: 'Please set your investment preferences first to discover matched startups.'
        });
      }

      const [userMatches] = await pool.query<any[]>(
        `${baseQuery} WHERE i.user_id = ? ORDER BY m.match_score DESC`,
        [u.user_id]
      );

      const results = formatMatchBreakdown(userMatches);
      return res.json({
        hasPreferences: true,
        role: 'INVESTOR',
        matches: results,
        message: results.length === 0 ? 'Preferences saved! Click "Run Matching" to find compatible startups.' : null
      });
    }

    if (u.role === 'STARTUP') {
      const [userMatches] = await pool.query<any[]>(
        `${baseQuery} WHERE s.user_id = ? ORDER BY m.match_score DESC`,
        [u.user_id]
      );

      const results = formatMatchBreakdown(userMatches);
      return res.json({
        hasPreferences: true,
        role: 'STARTUP',
        matches: results,
        message: results.length === 0 ? 'No matched investors found yet. When investors run matching, compatible investors will appear here.' : null
      });
    }

    // ADMIN
    const [allMatches] = await pool.query<any[]>(
      `${baseQuery} ORDER BY m.match_score DESC LIMIT 50`
    );
    const results = formatMatchBreakdown(allMatches);
    return res.json({
      hasPreferences: true,
      role: 'ADMIN',
      matches: results,
      message: null
    });

  } catch (error) {
    console.error('Fetch matches error:', error);
    return res.status(500).json({ error: 'Unable to fetch matches.' });
  }
});

// POST /api/match (Run matching engine)
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const u = req.user!;

  if (u.role !== 'INVESTOR' && u.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only investors can execute the matching engine based on investment preferences.' });
  }

  try {
    let currentInvestorId: number | null = null;

    if (u.role === 'INVESTOR') {
      const [existingInv] = await pool.query<any[]>(
        'SELECT investor_id FROM investor WHERE user_id = ? LIMIT 1',
        [u.user_id]
      );

      if (!existingInv.length) {
        const firmName = u.name ? `${u.name}'s Ventures` : 'Angel Portfolio';
        const [ins]: any = await pool.execute(
          `INSERT INTO investor (user_id, investor_type, firm_name, location)
           VALUES (?, 'Angel Investor', ?, 'India')`,
          [u.user_id, firmName]
        );
        currentInvestorId = ins.insertId;
      } else {
        currentInvestorId = existingInv[0].investor_id;
      }

      const [userPref] = await pool.query<any[]>(
        'SELECT preference_id FROM investor_preferences WHERE investor_id = ? LIMIT 1',
        [currentInvestorId]
      );

      if (!userPref.length) {
        return res.status(400).json({
          ok: false,
          needsPreferences: true,
          error: 'Please configure your investment preferences first before running the matching engine.'
        });
      }
    }

    const [startups] = await pool.query<any[]>(`
      SELECT
        s.startup_id,
        s.startup_name,
        s.industry_id,
        s.funding_stage,
        COALESCE(
          (
            SELECT fr.amount_required
            FROM funding_round fr
            WHERE fr.startup_id = s.startup_id
            ORDER BY (fr.status = 'OPEN') DESC, fr.round_id DESC
            LIMIT 1
          ),
          0
        ) AS amount_required
      FROM startup s
    `);

    const [preferences] = await pool.query<any[]>(`
      SELECT investor_id, industry_id, preferred_stage, min_ticket, max_ticket
      FROM investor_preferences
    `);

    if (!startups.length || !preferences.length) {
      return res.json({
        ok: true,
        saved: 0,
        message: 'No startups or investor preferences available to match.'
      });
    }

    const [investors] = await pool.query<any[]>(`
      SELECT investor_id, firm_name, investor_type, user_id
      FROM investor
      WHERE investor_id IN (${preferences.map((p) => p.investor_id).join(',')})
    `);

    const prefMap = new Map(preferences.map((p) => [p.investor_id, p]));
    const matchValues: any[] = [];
    let userMatchesCount = 0;

    for (const inv of investors) {
      const p = prefMap.get(inv.investor_id);
      if (!p) continue;

      for (const st of startups) {
        let score = 35;

        // Industry fit
        if (p.industry_id != null) {
          if (Number(p.industry_id) === Number(st.industry_id)) {
            score += 35;
          } else {
            score += 8;
          }
        } else {
          score += 25;
        }

        // Funding stage fit
        if (p.preferred_stage) {
          if (p.preferred_stage === st.funding_stage) {
            score += 25;
          } else {
            score += 10;
          }
        } else {
          score += 20;
        }

        // Investment ticket fit
        const amount = Number(st.amount_required);
        if (p.min_ticket != null && p.max_ticket != null && amount > 0) {
          if (amount >= Number(p.min_ticket) && amount <= Number(p.max_ticket)) {
            score += 15;
          } else if (amount >= Number(p.min_ticket) * 0.7 && amount <= Number(p.max_ticket) * 1.3) {
            score += 8;
          } else {
            score += 3;
          }
        } else if (p.min_ticket != null && amount >= Number(p.min_ticket)) {
          score += 12;
        } else if (p.max_ticket != null && amount <= Number(p.max_ticket)) {
          score += 12;
        } else {
          score += 10;
        }

        score = Math.min(100, Math.max(50, Math.round(score)));
        matchValues.push([st.startup_id, inv.investor_id, score]);

        if (currentInvestorId !== null && inv.investor_id === currentInvestorId) {
          userMatchesCount++;
        }
      }
    }

    if (matchValues.length > 0) {
      const placeholders = matchValues.map(() => '(?, ?, ?, CURDATE(), "PENDING")').join(',');
      const flatParams = matchValues.flat();

      await pool.query(
        `INSERT INTO match_result (startup_id, investor_id, match_score, matched_date, status)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE
           match_score = VALUES(match_score),
           matched_date = VALUES(matched_date)`,
        flatParams
      );
    }

    void logActivity('matching_run', {
      user_id: u.user_id,
      records: matchValues.length
    });

    const displayCount = currentInvestorId !== null ? userMatchesCount : matchValues.length;

    return res.json({
      ok: true,
      saved: displayCount,
      message: `Matching engine completed! Ranked ${displayCount} startups based on your investment preferences.`
    });

  } catch (error) {
    console.error('Matching error:', error);
    return res.status(500).json({ error: 'Matching failed. Please verify database connection.' });
  }
});

// PATCH /api/match/:matchId
router.patch('/:matchId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const u = req.user!;

  try {
    const id = Number(req.params.matchId);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid match ID.' });
    }

    const { status } = req.body || {};

    if (!['ACCEPTED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const [result]: any = await pool.execute(
      `
      UPDATE match_result m
      INNER JOIN investor i ON i.investor_id = m.investor_id
      INNER JOIN startup s ON s.startup_id = m.startup_id
      SET m.status = ?
      WHERE m.match_id = ?
        AND (i.user_id = ? OR s.user_id = ? OR ? = 'ADMIN')
        AND m.status = 'PENDING'
      `,
      [status, id, u.user_id, u.user_id, u.role]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Match not found, already processed, or unauthorized.'
      });
    }

    return res.json({
      ok: true,
      message: `Match successfully ${status.toLowerCase()}.`,
      status
    });

  } catch (error) {
    console.error('Match status update error:', error);
    return res.status(500).json({ error: 'Unable to update match status.' });
  }
});

export default router;
