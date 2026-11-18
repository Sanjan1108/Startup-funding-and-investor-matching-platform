import { Router, Response } from 'express';
import { pool } from '../lib/db';
import { logActivity } from '../lib/audit';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const config: Record<string, {
  table: string;
  select: string;
  fields: string[];
  order: string;
}> = {
  startups: {
    table: 'startup',
    select: 's.startup_id,s.startup_name,s.description,s.location,s.funding_stage,s.website,i.industry_name',
    fields: ['startup_name', 'description', 'location', 'funding_stage', 'website', 'industry_id', 'user_id'],
    order: 's.startup_id DESC'
  },
  investors: {
    table: 'investor',
    select: 'i.investor_id,i.investor_type,i.firm_name,i.description,i.location,i.website,u.name AS contact_name,u.email',
    fields: ['investor_type', 'firm_name', 'description', 'location', 'website', 'user_id'],
    order: 'i.investor_id DESC'
  },
  funding: {
    table: 'funding_round',
    select: 'f.round_id,f.round_name,f.round_type,f.amount_required,f.currency,f.status,s.startup_name',
    fields: ['startup_id', 'round_name', 'round_type', 'amount_required', 'currency', 'valuation_expected', 'status'],
    order: 'f.round_id DESC'
  },
  meetings: {
    table: 'meeting',
    select: 'm.meeting_id,m.meeting_date,m.meeting_type,m.outcome,s.startup_name,i.firm_name',
    fields: ['startup_id', 'investor_id', 'meeting_date', 'meeting_type', 'notes', 'outcome'],
    order: 'm.meeting_date DESC'
  },
  investments: {
    table: 'investment',
    select: 'x.investment_id,x.amount_invested,x.equity_percentage,x.investment_date,s.startup_name,i.firm_name,f.round_name',
    fields: ['round_id', 'investor_id', 'amount_invested', 'equity_percentage', 'investment_date', 'terms'],
    order: 'x.investment_date DESC'
  },
  negotiations: {
    table: 'negotiation',
    select: 'n.negotiation_id,n.amount_offered,n.equity_percentage,n.status,n.round_number,n.terms,s.startup_name,i.firm_name,f.round_name',
    fields: ['startup_id', 'investor_id', 'round_id', 'proposed_by', 'amount_offered', 'equity_percentage', 'valuation_expected', 'status', 'terms'],
    order: 'n.negotiation_id DESC'
  }
};

// GET /api/data?type=...
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const key = String(req.query.type || '');
  const c = config[key];

  if (!c) {
    return res.status(400).json({ error: 'Unknown data type' });
  }

  let query = '';

  if (key === 'startups') {
    query = `SELECT ${c.select}
      FROM startup s
      LEFT JOIN industry i ON i.industry_id = s.industry_id
      ORDER BY ${c.order}`;
  }

  if (key === 'investors') {
    query = `SELECT ${c.select}
      FROM investor i
      LEFT JOIN \`user\` u ON u.user_id = i.user_id
      ORDER BY ${c.order}`;
  }

  if (key === 'funding') {
    query = `SELECT ${c.select}
      FROM funding_round f
      LEFT JOIN startup s ON s.startup_id = f.startup_id
      ORDER BY ${c.order}`;
  }

  if (key === 'meetings') {
    query = `SELECT ${c.select}
      FROM meeting m
      LEFT JOIN startup s ON s.startup_id = m.startup_id
      LEFT JOIN investor i ON i.investor_id = m.investor_id
      ORDER BY ${c.order}`;
  }

  if (key === 'investments') {
    query = `SELECT ${c.select}
      FROM investment x
      LEFT JOIN funding_round f ON f.round_id = x.round_id
      LEFT JOIN startup s ON s.startup_id = f.startup_id
      LEFT JOIN investor i ON i.investor_id = x.investor_id
      ORDER BY ${c.order}`;
  }

  if (key === 'negotiations') {
    query = `SELECT ${c.select}
      FROM negotiation n
      LEFT JOIN startup s ON s.startup_id = n.startup_id
      LEFT JOIN investor i ON i.investor_id = n.investor_id
      LEFT JOIN funding_round f ON f.round_id = n.round_id
      ORDER BY ${c.order}`;
  }

  try {
    const [rows] = await pool.query(query);
    return res.json(rows);
  } catch (error: any) {
    console.error('Data fetch error:', error);
    return res.status(500).json({ error: error?.message || 'Database query failed.' });
  }
});

// POST /api/data
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  try {
    const { type, ...body } = req.body || {};
    const c = config[type];

    if (!c) {
      return res.status(400).json({ error: 'Unknown data type' });
    }

    // Role-based record creation checks
    if (type === 'startups' && user.role !== 'STARTUP' && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only startup founders or administrators can register a startup profile.' });
    }
    if (type === 'investors' && user.role !== 'INVESTOR' && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only investors or administrators can register an investor profile.' });
    }
    if (type === 'funding' && user.role !== 'STARTUP' && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only startup founders can open a funding round.' });
    }

    const fields = c.fields.filter(field => body[field] !== undefined);

    if (!fields.length) {
      return res.status(400).json({ error: 'No fields supplied' });
    }

    const values = fields.map(field => body[field]);

    if (
      (type === 'startups' || type === 'investors') &&
      !body.user_id
    ) {
      fields.push('user_id');
      values.push(user.user_id);
    }

    const placeholders = fields.map(() => '?').join(',');
    const sql = `INSERT INTO ${c.table} (${fields.join(',')}) VALUES (${placeholders})`;

    const [result]: any = await pool.execute(sql, values);

    void logActivity(`${type}_created`, {
      id: result.insertId,
      by: user.user_id
    }).catch(error => {
      console.error('Activity logging failed:', error);
    });

    return res.status(201).json({ ok: true, id: result.insertId });

  } catch (error: any) {
    console.error('Data save error:', error);
    return res.status(400).json({
      error: error.code === 'ER_NO_REFERENCED_ROW_2'
        ? 'Please choose a valid related record.'
        : 'Could not save record. Check required fields.'
    });
  }
});

export default router;
