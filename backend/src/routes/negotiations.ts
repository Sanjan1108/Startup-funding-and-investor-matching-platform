import { Router, Response } from 'express';
import { pool, mongoDb } from '../lib/db';
import { logActivity } from '../lib/audit';
import {
  ensureNegotiationTable,
  getMongoNegotiationThread,
  addMongoNegotiationEvent
} from '../lib/negotiations';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/negotiations
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  await ensureNegotiationTable();

  const isOptions = req.query.options === '1';

  if (isOptions) {
    try {
      const [startups] = await pool.query<any[]>(
        'SELECT startup_id, startup_name, funding_stage FROM startup ORDER BY startup_name ASC'
      );
      const [investors] = await pool.query<any[]>(
        'SELECT investor_id, firm_name, investor_type FROM investor ORDER BY firm_name ASC'
      );
      const [fundingRounds] = await pool.query<any[]>(
        `SELECT fr.round_id, fr.startup_id, fr.round_name, fr.round_type, fr.amount_required, fr.valuation_expected, s.startup_name
         FROM funding_round fr
         JOIN startup s ON s.startup_id = fr.startup_id
         WHERE fr.status = 'OPEN'
           AND NOT EXISTS (
             SELECT 1 FROM negotiation n WHERE n.round_id = fr.round_id AND n.status = 'ACCEPTED'
           )
         ORDER BY fr.round_id DESC`
      );

      return res.json({
        startups: startups || [],
        investors: investors || [],
        fundingRounds: fundingRounds || []
      });
    } catch (err: any) {
      console.error('Error fetching negotiation options:', err);
      return res.status(500).json({ error: 'Could not load form options.' });
    }
  }

  try {
    const [rows] = await pool.query<any[]>(`
      SELECT
        n.negotiation_id,
        n.startup_id,
        n.investor_id,
        n.round_id,
        n.proposed_by,
        n.amount_offered,
        n.equity_percentage,
        n.valuation_expected,
        n.status,
        n.terms,
        n.round_number,
        n.created_at,
        n.updated_at,
        s.startup_name,
        s.funding_stage,
        s.user_id AS startup_user_id,
        i.firm_name,
        i.user_id AS investor_user_id,
        fr.round_name,
        fr.amount_required,
        fr.status AS round_status,
        (
          SELECT COUNT(*)
          FROM negotiation n_acc
          WHERE n_acc.round_id = n.round_id AND n_acc.status = 'ACCEPTED'
        ) AS round_accepted_count,
        (
          SELECT n_win.negotiation_id
          FROM negotiation n_win
          WHERE n_win.round_id = n.round_id AND n_win.status = 'ACCEPTED'
          LIMIT 1
        ) AS accepted_negotiation_id,
        (
          SELECT i_win.firm_name
          FROM negotiation n_win
          JOIN investor i_win ON i_win.investor_id = n_win.investor_id
          WHERE n_win.round_id = n.round_id AND n_win.status = 'ACCEPTED'
          LIMIT 1
        ) AS accepted_firm_name
      FROM negotiation n
      JOIN startup s ON s.startup_id = n.startup_id
      JOIN investor i ON i.investor_id = n.investor_id
      JOIN funding_round fr ON fr.round_id = n.round_id
      ORDER BY n.updated_at DESC
    `);

    let threadsMap = new Map<number, { latestNote?: string; eventCount?: number }>();
    try {
      const db = await mongoDb();
      const threads = await db.collection('negotiation_threads').find({}).toArray();
      for (const t of threads) {
        if (t.negotiation_id && Array.isArray(t.events) && t.events.length > 0) {
          const lastEvent = t.events[t.events.length - 1];
          threadsMap.set(Number(t.negotiation_id), {
            latestNote: lastEvent.note || '',
            eventCount: t.events.length
          });
        }
      }
    } catch {
      // Graceful fallback if MongoDB is not responding
    }

    const enhanced = rows.map((r) => {
      const threadMeta = threadsMap.get(Number(r.negotiation_id));
      const equity = Number(r.equity_percentage);
      const amount = Number(r.amount_offered);
      const impliedVal = equity > 0 ? (amount / (equity / 100)) : null;

      return {
        ...r,
        implied_valuation: impliedVal,
        latest_note: threadMeta?.latestNote || '',
        timeline_count: threadMeta?.eventCount || 1
      };
    });

    return res.json(enhanced);
  } catch (err: any) {
    console.error('Error fetching negotiations:', err);
    return res.status(500).json({ error: 'Failed to retrieve negotiations.' });
  }
});

// POST /api/negotiations
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  await ensureNegotiationTable();

  try {
    const body = req.body || {};
    const startupId = Number(body.startup_id);
    const investorId = Number(body.investor_id);
    const roundId = Number(body.round_id);
    const amountOffered = Number(body.amount_offered);
    const equityPercentage = Number(body.equity_percentage);
    const proposedBy = (body.proposed_by === 'STARTUP' || body.proposed_by === 'INVESTOR')
      ? body.proposed_by
      : (user.role === 'INVESTOR' ? 'INVESTOR' : 'STARTUP');
    const terms = String(body.terms || '').trim();
    const initialNote = String(body.initial_note || '').trim();

    if (!startupId || !investorId || !roundId) {
      return res.status(400).json({ error: 'Startup, Investor, and Funding Round are required.' });
    }

    if (!Number.isFinite(amountOffered) || amountOffered <= 0) {
      return res.status(400).json({ error: 'Proposed amount must be greater than 0.' });
    }

    if (!Number.isFinite(equityPercentage) || equityPercentage < 0 || equityPercentage > 100) {
      return res.status(400).json({ error: 'Equity percentage must be between 0 and 100.' });
    }

    const [rounds] = await pool.query<any[]>(
      'SELECT amount_required, status FROM funding_round WHERE round_id = ?',
      [roundId]
    );

    if (!rounds.length) {
      return res.status(404).json({ error: 'Funding round not found.' });
    }

    const round = rounds[0];
    if (round.status === 'CLOSED') {
      return res.status(400).json({
        error: 'This funding round is closed. No new negotiations can be initiated.'
      });
    }

    const [existingAccepted] = await pool.query<any[]>(
      'SELECT negotiation_id FROM negotiation WHERE round_id = ? AND status = "ACCEPTED" LIMIT 1',
      [roundId]
    );
    if (existingAccepted.length > 0) {
      return res.status(400).json({
        error: 'An investment offer has already been accepted for this funding round. No further proposals can be created.'
      });
    }

    if (amountOffered > Number(round.amount_required)) {
      return res.status(400).json({
        error: `Offered amount (₹${amountOffered.toLocaleString('en-IN')}) cannot exceed the funding round requirement (₹${Number(round.amount_required).toLocaleString('en-IN')}).`
      });
    }

    const impliedVal = equityPercentage > 0
      ? (amountOffered / (equityPercentage / 100))
      : null;

    const [insertResult]: any = await pool.execute(
      `INSERT INTO negotiation
       (startup_id, investor_id, round_id, proposed_by, amount_offered, equity_percentage, valuation_expected, status, terms, round_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PROPOSED', ?, 1)`,
      [startupId, investorId, roundId, proposedBy, amountOffered, equityPercentage, impliedVal, terms || null]
    );

    const negotiationId = insertResult.insertId;

    void addMongoNegotiationEvent(negotiationId, {
      round_number: 1,
      author_role: proposedBy,
      author_name: user.name,
      amount_offered: amountOffered,
      equity_percentage: equityPercentage,
      action: 'PROPOSED',
      note: initialNote || `Initial term sheet proposal submitted by ${user.name} (${proposedBy.toLowerCase()}).`
    });

    void logActivity('negotiation_created', {
      negotiation_id: negotiationId,
      startup_id: startupId,
      investor_id: investorId,
      round_id: roundId,
      amount: amountOffered,
      equity: equityPercentage,
      by: user.user_id
    });

    return res.status(201).json({
      ok: true,
      id: negotiationId,
      message: 'Negotiation proposal initiated successfully!'
    });

  } catch (err: any) {
    console.error('Error creating negotiation:', err);
    return res.status(400).json({
      error: err.code === 'ER_SIGNAL_EXCEPTION'
        ? err.message
        : 'Could not create negotiation. Please verify all inputs.'
    });
  }
});

// GET /api/negotiations/:id
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  await ensureNegotiationTable();

  try {
    const negotiationId = Number(req.params.id);

    if (!Number.isInteger(negotiationId) || negotiationId <= 0) {
      return res.status(400).json({ error: 'Invalid negotiation ID.' });
    }

    const [rows] = await pool.query<any[]>(`
      SELECT
        n.*,
        s.startup_name,
        s.funding_stage,
        s.location,
        i.firm_name,
        i.investor_type,
        fr.round_name,
        fr.amount_required,
        fr.status AS round_status,
        fr.currency
      FROM negotiation n
      JOIN startup s ON s.startup_id = n.startup_id
      JOIN investor i ON i.investor_id = n.investor_id
      JOIN funding_round fr ON fr.round_id = n.round_id
      WHERE n.negotiation_id = ?
    `, [negotiationId]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Negotiation not found.' });
    }

    const negotiation = rows[0];
    const thread = await getMongoNegotiationThread(negotiationId);

    return res.json({
      negotiation,
      events: thread?.events || []
    });

  } catch (err: any) {
    console.error('Error fetching negotiation details:', err);
    return res.status(500).json({ error: 'Failed to retrieve negotiation.' });
  }
});

// PATCH /api/negotiations/:id
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  await ensureNegotiationTable();

  try {
    const negotiationId = Number(req.params.id);

    if (!Number.isInteger(negotiationId) || negotiationId <= 0) {
      return res.status(400).json({ error: 'Invalid negotiation ID.' });
    }

    const body = req.body || {};
    const action = String(body.action || '').toUpperCase();

    const [existing] = await pool.query<any[]>(
      `SELECT n.*, fr.amount_required, fr.status AS round_status,
              s.user_id AS startup_user_id,
              i.user_id AS investor_user_id
       FROM negotiation n
       JOIN startup s ON s.startup_id = n.startup_id
       JOIN investor i ON i.investor_id = n.investor_id
       JOIN funding_round fr ON fr.round_id = n.round_id
       WHERE n.negotiation_id = ?`,
      [negotiationId]
    );

    if (!existing.length) {
      return res.status(404).json({ error: 'Negotiation record not found.' });
    }

    const current = existing[0];

    if (current.status === 'ACCEPTED') {
      return res.status(400).json({ error: 'This negotiation has already been accepted and finalized.' });
    }
    if (current.status === 'REJECTED' && action !== 'REOPEN') {
      return res.status(400).json({ error: 'This negotiation is marked as rejected.' });
    }

    // ACTION: COUNTER_OFFER
    if (action === 'COUNTER_OFFER') {
      // Verify round is still open and no winning offer has been accepted yet
      const [alreadyAccepted] = await pool.query<any[]>(
        'SELECT negotiation_id FROM negotiation WHERE round_id = ? AND status = "ACCEPTED" LIMIT 1',
        [current.round_id]
      );
      if (alreadyAccepted.length > 0 || current.round_status === 'CLOSED') {
        return res.status(400).json({
          error: 'Cannot counter-offer: This funding round is closed or an offer has already been accepted.'
        });
      }

      // Verify participant ownership
      if (user.role === 'STARTUP' && Number(current.startup_user_id) !== Number(user.user_id)) {
        return res.status(403).json({ error: 'You can only negotiate on behalf of your own startup.' });
      }
      if (user.role === 'INVESTOR' && Number(current.investor_user_id) !== Number(user.user_id)) {
        return res.status(403).json({ error: 'You can only negotiate on behalf of your own investor firm.' });
      }

      const amountOffered = Number(body.amount_offered);
      const equityPercentage = Number(body.equity_percentage);
      const terms = body.terms !== undefined ? String(body.terms).trim() : current.terms;
      const note = String(body.note || '').trim();

      if (!Number.isFinite(amountOffered) || amountOffered <= 0) {
        return res.status(400).json({ error: 'Proposed amount must be greater than 0.' });
      }

      if (!Number.isFinite(equityPercentage) || equityPercentage < 0 || equityPercentage > 100) {
        return res.status(400).json({ error: 'Equity percentage must be between 0 and 100.' });
      }

      if (amountOffered > Number(current.amount_required)) {
        return res.status(400).json({
          error: `Counter-offer amount (₹${amountOffered.toLocaleString('en-IN')}) cannot exceed round requirement (₹${Number(current.amount_required).toLocaleString('en-IN')}).`
        });
      }

      const impliedVal = equityPercentage > 0 ? (amountOffered / (equityPercentage / 100)) : null;
      const newRoundNumber = Number(current.round_number || 1) + 1;

      let newProposedBy = (body.proposed_by === 'STARTUP' || body.proposed_by === 'INVESTOR')
        ? body.proposed_by
        : (user.role === 'INVESTOR' ? 'INVESTOR' : user.role === 'STARTUP' ? 'STARTUP' : (current.proposed_by === 'STARTUP' ? 'INVESTOR' : 'STARTUP'));

      await pool.execute(
        `UPDATE negotiation
         SET amount_offered = ?,
             equity_percentage = ?,
             valuation_expected = ?,
             terms = ?,
             proposed_by = ?,
             status = 'COUNTER_OFFERED',
             round_number = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE negotiation_id = ?`,
        [amountOffered, equityPercentage, impliedVal, terms || null, newProposedBy, newRoundNumber, negotiationId]
      );

      void addMongoNegotiationEvent(negotiationId, {
        round_number: newRoundNumber,
        author_role: newProposedBy,
        author_name: user.name,
        amount_offered: amountOffered,
        equity_percentage: equityPercentage,
        action: 'COUNTER_OFFERED',
        note: note || `Counter-offer submitted in round #${newRoundNumber} by ${user.name} (${newProposedBy.toLowerCase()}).`
      });

      void logActivity('negotiation_counter_offer', {
        negotiation_id: negotiationId,
        round_number: newRoundNumber,
        amount: amountOffered,
        equity: equityPercentage,
        by: user.user_id
      });

      return res.json({
        ok: true,
        message: `Counter-offer (Round ${newRoundNumber}) submitted successfully!`,
        round_number: newRoundNumber
      });
    }

    // ACTION: ACCEPT
    if (action === 'ACCEPT') {
      // 1. Role verification: ONLY STARTUP (or ADMIN) can accept offers
      if (user.role !== 'STARTUP' && user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Investors cannot accept term sheet offers. Only the startup founder can accept an investment offer.'
        });
      }

      // 2. Ownership verification: Startup must belong to the logged-in user
      if (user.role === 'STARTUP' && Number(current.startup_user_id) !== Number(user.user_id)) {
        return res.status(403).json({
          error: 'You do not have permission to accept offers for this startup. Only the startup founder can accept.'
        });
      }

      // 3. One winning offer rule: check if an offer has already been accepted for this round
      const [alreadyAccepted] = await pool.query<any[]>(
        'SELECT negotiation_id FROM negotiation WHERE round_id = ? AND status = "ACCEPTED" LIMIT 1',
        [current.round_id]
      );
      if (alreadyAccepted.length > 0) {
        return res.status(400).json({
          error: `An investment offer has already been accepted for this funding round (Round #${current.round_id}). A startup can only accept one winning offer from any investor, not all.`
        });
      }

      // 4. Check if funding round is closed
      const [roundRows] = await pool.query<any[]>(
        'SELECT status, amount_required FROM funding_round WHERE round_id = ?',
        [current.round_id]
      );
      if (!roundRows.length || roundRows[0].status === 'CLOSED') {
        return res.status(400).json({
          error: 'This funding round is already closed. No further investment offers can be accepted.'
        });
      }

      const investmentDate = body.investment_date || new Date().toISOString().split('T')[0];
      const finalTerms = body.terms || current.terms || `Final terms agreed via negotiation #${negotiationId}`;
      const note = String(body.note || '').trim();

      const conn = await pool.getConnection();
      let createdInvestmentId: number | null = null;
      let competingNegotiations: any[] = [];

      try {
        await conn.beginTransaction();

        // 1. Mark this winning negotiation as ACCEPTED
        await conn.execute(
          `UPDATE negotiation
           SET status = 'ACCEPTED',
               updated_at = CURRENT_TIMESTAMP
           WHERE negotiation_id = ?`,
          [negotiationId]
        );

        // 2. Record the investment
        const [invResult]: any = await conn.execute(
          `INSERT INTO investment
           (round_id, investor_id, amount_invested, equity_percentage, investment_date, terms)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            current.round_id,
            current.investor_id,
            current.amount_offered,
            current.equity_percentage,
            investmentDate,
            finalTerms
          ]
        );
        createdInvestmentId = invResult.insertId;

        // 3. Close the funding round so no other investment or negotiation can proceed
        await conn.execute(
          `UPDATE funding_round SET status = 'CLOSED' WHERE round_id = ?`,
          [current.round_id]
        );

        // 4. Find all other competing pending negotiations for this same funding round
        const [competing] = await conn.query<any[]>(
          `SELECT negotiation_id, investor_id, amount_offered
           FROM negotiation
           WHERE round_id = ? AND negotiation_id != ? AND status IN ('PROPOSED', 'COUNTER_OFFERED')`,
          [current.round_id, negotiationId]
        );
        competingNegotiations = competing;

        // 5. Automatically reject competing negotiations for this round
        if (competingNegotiations.length > 0) {
          await conn.execute(
            `UPDATE negotiation
             SET status = 'REJECTED',
                 updated_at = CURRENT_TIMESTAMP
             WHERE round_id = ? AND negotiation_id != ? AND status IN ('PROPOSED', 'COUNTER_OFFERED')`,
            [current.round_id, negotiationId]
          );
        }

        await conn.commit();
      } catch (txError: any) {
        await conn.rollback();
        throw txError;
      } finally {
        conn.release();
      }

      // Add timeline event for the accepted negotiation
      void addMongoNegotiationEvent(negotiationId, {
        round_number: current.round_number,
        author_role: user.role,
        author_name: user.name,
        amount_offered: Number(current.amount_offered),
        equity_percentage: Number(current.equity_percentage),
        action: 'ACCEPTED',
        note: note || `Investment offer accepted by startup founder ${user.name}! Deal closed. Recorded as Investment #${createdInvestmentId}. Round #${current.round_id} is now CLOSED.`
      });

      // Add timeline events for all auto-rejected competing negotiations
      for (const comp of competingNegotiations) {
        void addMongoNegotiationEvent(comp.negotiation_id, {
          round_number: 1,
          author_role: 'SYSTEM',
          author_name: 'VentureLink System',
          action: 'REJECTED',
          note: `Round closed: Startup founder accepted winning investment offer #${negotiationId} for funding round #${current.round_id}. Competing offer closed.`
        });
      }

      void logActivity('negotiation_accepted', {
        negotiation_id: negotiationId,
        investment_id: createdInvestmentId,
        round_id: current.round_id,
        amount: current.amount_offered,
        competing_rejected_count: competingNegotiations.length,
        by: user.user_id
      });

      return res.json({
        ok: true,
        message: `Winning term sheet accepted! Deal successfully finalized and recorded in Investments.${competingNegotiations.length > 0 ? ` Note: ${competingNegotiations.length} competing offer(s) for this round were automatically closed.` : ''}`,
        investment_id: createdInvestmentId,
        competing_rejected: competingNegotiations.length
      });
    }

    // ACTION: REJECT
    if (action === 'REJECT') {
      // Permission check: Startup founder, Investor of this deal, or Admin
      if (user.role === 'STARTUP' && Number(current.startup_user_id) !== Number(user.user_id)) {
        return res.status(403).json({ error: 'You can only reject offers made to your startup.' });
      }
      if (user.role === 'INVESTOR' && Number(current.investor_user_id) !== Number(user.user_id)) {
        return res.status(403).json({ error: 'You can only withdraw/decline offers from your investor firm.' });
      }

      const note = String(body.note || '').trim();

      await pool.execute(
        `UPDATE negotiation
         SET status = 'REJECTED',
             updated_at = CURRENT_TIMESTAMP
         WHERE negotiation_id = ?`,
        [negotiationId]
      );

      void addMongoNegotiationEvent(negotiationId, {
        round_number: current.round_number,
        author_role: user.role,
        author_name: user.name,
        action: 'REJECTED',
        note: note || `Negotiation declined by ${user.name} (${user.role.toLowerCase()}).`
      });

      void logActivity('negotiation_rejected', {
        negotiation_id: negotiationId,
        by: user.user_id
      });

      return res.json({
        ok: true,
        message: 'Negotiation offer marked as rejected.'
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err: any) {
    console.error('Error updating negotiation:', err);
    return res.status(500).json({
      error: err.code === 'ER_SIGNAL_EXCEPTION'
        ? err.message
        : 'Failed to process negotiation update.'
    });
  }
});

export default router;
