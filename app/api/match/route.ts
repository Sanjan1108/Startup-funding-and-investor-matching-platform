import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { pool } from '@/lib/db';
import { logActivity } from '@/lib/audit';

export async function POST() {
  const u = await currentUser();

  if (!u) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const [rows] = await pool.query<any[]>(
      `
      SELECT
        s.startup_id,
        s.startup_name,
        s.industry_id,
        s.funding_stage,
        i.investor_id,
        i.firm_name,
        i.investor_type,

        COALESCE(
          (
            SELECT MAX(fr.amount_required)
            FROM funding_round fr
            WHERE fr.startup_id = s.startup_id
              AND fr.status = 'OPEN'
          ),
          0
        ) AS amount_required

      FROM startup s
      CROSS JOIN investor i
      WHERE i.user_id = ?
      `,
      [u.user_id]
    );

    const [preferences] = await pool.query<any[]>(
      `
      SELECT
        ip.investor_id,
        ip.industry_id,
        ip.preferred_stage,
        ip.min_ticket,
        ip.max_ticket

      FROM investor_preferences ip

      INNER JOIN investor i
        ON i.investor_id = ip.investor_id

      WHERE i.user_id = ?
      `,
      [u.user_id]
    );

    const prefMap = new Map(
      preferences.map((p) => [p.investor_id, p])
    );

    let saved = 0;

    for (const startup of rows) {
      const p = prefMap.get(startup.investor_id);

      let score = 35;

      // Industry matching
      if (p?.industry_id != null) {
        if (
          Number(p.industry_id) ===
          Number(startup.industry_id)
        ) {
          score += 35;
        }
      } else {
        score += 15;
      }

      // Funding stage matching
      if (p?.preferred_stage) {
        if (p.preferred_stage === startup.funding_stage) {
          score += 20;
        }
      } else {
        score += 10;
      }

      // Investment ticket matching
      const amount = Number(startup.amount_required);

      if (
        p?.min_ticket != null &&
        p?.max_ticket != null &&
        amount > 0 &&
        amount >= Number(p.min_ticket) &&
        amount <= Number(p.max_ticket)
      ) {
        score += 10;
      } else if (p?.min_ticket == null) {
        score += 5;
      }

      score = Math.min(100, score);

      if (score >= 50) {
        await pool.execute(
          `
          INSERT INTO match_result
          (
            startup_id,
            investor_id,
            match_score,
            matched_date,
            status
          )
          VALUES (?, ?, ?, CURDATE(), 'PENDING')

          ON DUPLICATE KEY UPDATE
            match_score = VALUES(match_score),
            matched_date = VALUES(matched_date)
          `,
          [
            startup.startup_id,
            startup.investor_id,
            score
          ]
        );

        saved++;
      } else {
        await pool.execute(
          `
          DELETE FROM match_result
          WHERE startup_id = ?
            AND investor_id = ?
            AND status = 'PENDING'
          `,
          [
            startup.startup_id,
            startup.investor_id
          ]
        );
      }
    }

    await logActivity('matching_run', {
      user_id: u.user_id,
      records: saved
    });

    return NextResponse.json({
      ok: true,
      saved,
      message: `Matching completed. ${saved} startup-investor pairs were scored and saved.`
    });

  } catch (error) {
    console.error('Matching error:', error);

    return NextResponse.json(
      {
        error: 'Matching failed. Please check the database schema.'
      },
      { status: 500 }
    );
  }
}


// GET: Fetch matches and their open funding rounds

export async function GET() {
  const u = await currentUser();

  if (!u) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const [rows] = await pool.query<any[]>(
      `
      SELECT
        m.match_id,
        m.startup_id,
        m.investor_id,

        s.startup_name,
        s.industry_id,
        s.funding_stage,

        i.firm_name,

        m.match_score,
        m.status,
        m.matched_date,

        (
          SELECT fr.round_id
          FROM funding_round fr
          WHERE fr.startup_id = s.startup_id
            AND fr.status = 'OPEN'
          ORDER BY fr.round_id DESC
          LIMIT 1
        ) AS round_id,

        (
          SELECT fr.round_name
          FROM funding_round fr
          WHERE fr.startup_id = s.startup_id
            AND fr.status = 'OPEN'
          ORDER BY fr.round_id DESC
          LIMIT 1
        ) AS round_name,

        COALESCE(
          (
            SELECT MAX(fr.amount_required)
            FROM funding_round fr
            WHERE fr.startup_id = s.startup_id
              AND fr.status = 'OPEN'
          ),
          0
        ) AS amount_required,

        ip.industry_id AS preferred_industry_id,
        ip.preferred_stage,
        ip.min_ticket,
        ip.max_ticket

      FROM match_result m

      INNER JOIN startup s
        ON s.startup_id = m.startup_id

      INNER JOIN investor i
        ON i.investor_id = m.investor_id

      LEFT JOIN investor_preferences ip
        ON ip.investor_id = i.investor_id

      WHERE i.user_id = ?

      ORDER BY m.match_score DESC
      `,
      [u.user_id]
    );

    const results = rows.map((r) => {
      const breakdown = {
        base: 35,
        industry: 0,
        stage: 0,
        ticket: 0
      };

      const reasons: string[] = [];

      // Industry compatibility
      if (r.preferred_industry_id == null) {
        breakdown.industry = 15;

        reasons.push(
          'No specific industry preference.'
        );

      } else if (
        Number(r.preferred_industry_id) ===
        Number(r.industry_id)
      ) {
        breakdown.industry = 35;

        reasons.push(
          'Startup industry matches investor preference.'
        );

      } else {
        reasons.push(
          'Startup industry does not match investor preference.'
        );
      }

      // Funding stage compatibility
      if (!r.preferred_stage) {
        breakdown.stage = 10;

        reasons.push(
          'Investor accepts startups at any funding stage.'
        );

      } else if (
        r.preferred_stage === r.funding_stage
      ) {
        breakdown.stage = 20;

        reasons.push(
          'Funding stage matches investor preference.'
        );

      } else {
        reasons.push(
          'Funding stage does not match investor preference.'
        );
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
        breakdown.ticket = 10;

        reasons.push(
          'Funding requirement is within the investment range.'
        );

      } else if (r.min_ticket == null) {
        breakdown.ticket = 5;

        reasons.push(
          'No minimum investment restriction is specified.'
        );

      } else {
        reasons.push(
          'Funding requirement is outside the investment range or has no OPEN funding round.'
        );
      }

      return {
        ...r,
        breakdown,
        reasons
      };
    });

    return NextResponse.json(results);

  } catch (error) {
    console.error('Fetch matches error:', error);

    return NextResponse.json(
      {
        error: 'Unable to fetch matches.'
      },
      { status: 500 }
    );
  }
}