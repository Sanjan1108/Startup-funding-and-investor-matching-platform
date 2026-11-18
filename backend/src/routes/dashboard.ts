import { Router, Response } from 'express';
import { pool } from '../lib/db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/dashboard?view=...
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const u = req.user!;
  const requestedView = String(req.query.view || '');

  // Strict Role-Based View Enforcement:
  // - A STARTUP account can ONLY access the startup/founder dashboard.
  // - An INVESTOR account can ONLY access the investor portfolio dashboard.
  // - Only an ADMIN is permitted to switch between views or view platform overview.
  let activeView: string;
  if (u.role === 'STARTUP') {
    activeView = 'startup';
  } else if (u.role === 'INVESTOR') {
    activeView = 'investor';
  } else if (u.role === 'ADMIN') {
    activeView = (requestedView === 'startup' || requestedView === 'investor' || requestedView === 'platform')
      ? requestedView
      : 'platform';
  } else {
    activeView = 'platform';
  }

  // 1. DATA FOR STARTUP DASHBOARD (Only loaded if activeView is 'startup')
  let startupProfile: any = null;
  let startupMetrics = {
    raised: 0,
    target: 0,
    matches: 0,
    negotiations: 0,
    meetings: 0
  };
  let startupNegotiations: any[] = [];
  let startupRounds: any[] = [];
  let startupMatches: any[] = [];
  let startupInvestments: any[] = [];

  if (activeView === 'startup') {
    try {
      const [sRows] = await pool.query<any[]>(
        `SELECT s.*, ind.industry_name
         FROM startup s
         JOIN industry ind ON ind.industry_id = s.industry_id
         WHERE s.user_id = ?
         LIMIT 1`,
        [u.user_id]
      );

      if (sRows.length) {
        startupProfile = sRows[0];
        const sid = startupProfile.startup_id;

        const [r1] = await pool.query<any[]>(
          `SELECT COALESCE(SUM(inv.amount_invested),0) AS n
           FROM investment inv
           JOIN funding_round fr ON inv.round_id = fr.round_id
           WHERE fr.startup_id = ?`,
          [sid]
        );
        startupMetrics.raised = Number(r1[0]?.n || 0);

        const [r2] = await pool.query<any[]>(
          `SELECT COALESCE(SUM(amount_required),0) AS n
           FROM funding_round
           WHERE startup_id = ? AND status = 'OPEN'`,
          [sid]
        );
        startupMetrics.target = Number(r2[0]?.n || 0);

        const [r3] = await pool.query<any[]>(
          `SELECT COUNT(*) AS n FROM match_result WHERE startup_id = ?`,
          [sid]
        );
        startupMetrics.matches = Number(r3[0]?.n || 0);

        try {
          const [r4] = await pool.query<any[]>(
            `SELECT COUNT(*) AS n FROM negotiation WHERE startup_id = ? AND status IN ('PROPOSED', 'COUNTER_OFFERED')`,
            [sid]
          );
          startupMetrics.negotiations = Number(r4[0]?.n || 0);
        } catch {}

        const [r5] = await pool.query<any[]>(
          `SELECT COUNT(*) AS n FROM meeting WHERE startup_id = ?`,
          [sid]
        );
        startupMetrics.meetings = Number(r5[0]?.n || 0);

        try {
          const [negs] = await pool.query<any[]>(
            `SELECT n.*, i.firm_name, fr.round_name
             FROM negotiation n
             JOIN investor i ON i.investor_id = n.investor_id
             JOIN funding_round fr ON fr.round_id = n.round_id
             WHERE n.startup_id = ?
             ORDER BY n.updated_at DESC
             LIMIT 5`,
            [sid]
          );
          startupNegotiations = negs || [];
        } catch {}

        const [rounds] = await pool.query<any[]>(
          `SELECT fr.*,
                  COALESCE((SELECT SUM(amount_invested) FROM investment WHERE round_id = fr.round_id), 0) AS funded_amount
           FROM funding_round fr
           WHERE fr.startup_id = ?
           ORDER BY fr.round_id DESC`,
          [sid]
        );
        startupRounds = rounds || [];

        const [matches] = await pool.query<any[]>(
          `SELECT m.*, i.firm_name, i.investor_type, i.location
           FROM match_result m
           JOIN investor i ON i.investor_id = m.investor_id
           WHERE m.startup_id = ?
           ORDER BY m.match_score DESC
           LIMIT 4`,
          [sid]
        );
        startupMatches = matches || [];

        const [invs] = await pool.query<any[]>(
          `SELECT inv.*, i.firm_name, fr.round_name
           FROM investment inv
           JOIN investor i ON i.investor_id = inv.investor_id
           JOIN funding_round fr ON fr.round_id = inv.round_id
           WHERE fr.startup_id = ?
           ORDER BY inv.investment_date DESC
           LIMIT 4`,
          [sid]
        );
        startupInvestments = invs || [];
      }
    } catch (err) {
      console.error('Error loading startup dashboard data:', err);
    }
  }

  // 2. DATA FOR INVESTOR DASHBOARD (Only loaded if activeView is 'investor')
  let investorProfile: any = null;
  let investorMetrics = {
    deployed: 0,
    portfolioCount: 0,
    pipeline: 0,
    negotiations: 0,
    meetings: 0
  };
  let investorNegotiations: any[] = [];
  let investorPortfolio: any[] = [];
  let investorDealFlow: any[] = [];

  if (activeView === 'investor') {
    try {
      const [iRows] = await pool.query<any[]>(
        `SELECT i.*, ip.preferred_stage, ip.min_ticket, ip.max_ticket, ind.industry_name AS preferred_industry
         FROM investor i
         LEFT JOIN investor_preferences ip ON ip.investor_id = i.investor_id
         LEFT JOIN industry ind ON ind.industry_id = ip.industry_id
         WHERE i.user_id = ?
         LIMIT 1`,
        [u.user_id]
      );

      if (iRows.length) {
        investorProfile = iRows[0];
        const iid = investorProfile.investor_id;

        const [r1] = await pool.query<any[]>(
          `SELECT COALESCE(SUM(amount_invested),0) AS n FROM investment WHERE investor_id = ?`,
          [iid]
        );
        investorMetrics.deployed = Number(r1[0]?.n || 0);

        const [r2] = await pool.query<any[]>(
          `SELECT COUNT(DISTINCT fr.startup_id) AS n
           FROM investment inv
           JOIN funding_round fr ON inv.round_id = fr.round_id
           WHERE inv.investor_id = ?`,
          [iid]
        );
        investorMetrics.portfolioCount = Number(r2[0]?.n || 0);

        const [r3] = await pool.query<any[]>(
          `SELECT COUNT(*) AS n FROM match_result WHERE investor_id = ?`,
          [iid]
        );
        investorMetrics.pipeline = Number(r3[0]?.n || 0);

        try {
          const [r4] = await pool.query<any[]>(
            `SELECT COUNT(*) AS n FROM negotiation WHERE investor_id = ? AND status IN ('PROPOSED', 'COUNTER_OFFERED')`,
            [iid]
          );
          investorMetrics.negotiations = Number(r4[0]?.n || 0);
        } catch {}

        const [r5] = await pool.query<any[]>(
          `SELECT COUNT(*) AS n FROM meeting WHERE investor_id = ?`,
          [iid]
        );
        investorMetrics.meetings = Number(r5[0]?.n || 0);

        try {
          const [negs] = await pool.query<any[]>(
            `SELECT n.*, s.startup_name, s.funding_stage, fr.round_name
             FROM negotiation n
             JOIN startup s ON s.startup_id = n.startup_id
             JOIN funding_round fr ON fr.round_id = n.round_id
             WHERE n.investor_id = ?
             ORDER BY n.updated_at DESC
             LIMIT 5`,
            [iid]
          );
          investorNegotiations = negs || [];
        } catch {}

        const [portfolio] = await pool.query<any[]>(
          `SELECT inv.*, s.startup_name, s.funding_stage, ind.industry_name, fr.round_name
           FROM investment inv
           JOIN funding_round fr ON inv.round_id = fr.round_id
           JOIN startup s ON s.startup_id = fr.startup_id
           JOIN industry ind ON ind.industry_id = s.industry_id
           WHERE inv.investor_id = ?
           ORDER BY inv.investment_date DESC
           LIMIT 5`,
          [iid]
        );
        investorPortfolio = portfolio || [];

        const [deals] = await pool.query<any[]>(
          `SELECT m.*, s.startup_name, s.funding_stage, ind.industry_name,
                  (SELECT MAX(amount_required) FROM funding_round fr WHERE fr.startup_id = s.startup_id AND fr.status = 'OPEN') AS seeking_amount,
                  (SELECT fr.round_name FROM funding_round fr WHERE fr.startup_id = s.startup_id AND fr.status = 'OPEN' LIMIT 1) AS open_round_name
           FROM match_result m
           JOIN startup s ON s.startup_id = m.startup_id
           JOIN industry ind ON ind.industry_id = s.industry_id
           WHERE m.investor_id = ?
           ORDER BY m.match_score DESC
           LIMIT 4`,
          [iid]
        );
        investorDealFlow = deals || [];
      }
    } catch (err) {
      console.error('Error loading investor dashboard data:', err);
    }
  }

  // 3. DATA FOR PLATFORM OVERVIEW (Only loaded if activeView is 'platform')
  let platformStats = {
    startups: 0,
    investors: 0,
    matches: 0,
    negotiations: 0,
    invested: 0
  };

  if (activeView === 'platform') {
    try {
      const [c1] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM startup');
      platformStats.startups = Number(c1[0]?.n || 0);

      const [c2] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM investor');
      platformStats.investors = Number(c2[0]?.n || 0);

      const [c3] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM match_result');
      platformStats.matches = Number(c3[0]?.n || 0);

      try {
        const [c4] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM negotiation');
        platformStats.negotiations = Number(c4[0]?.n || 0);
      } catch {}

      const [c5] = await pool.query<any[]>('SELECT COALESCE(SUM(amount_invested),0) AS n FROM investment');
      platformStats.invested = Number(c5[0]?.n || 0);
    } catch {}
  }

  return res.json({
    activeView,
    startupProfile,
    startupMetrics,
    startupNegotiations,
    startupRounds,
    startupMatches,
    startupInvestments,
    investorProfile,
    investorMetrics,
    investorNegotiations,
    investorPortfolio,
    investorDealFlow,
    platformStats
  });
});

export default router;
