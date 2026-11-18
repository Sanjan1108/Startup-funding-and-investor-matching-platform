import { pool, mongoDb } from './db';

let tableChecked = false;

export async function ensureNegotiationTable() {
  if (tableChecked) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS negotiation (
        negotiation_id INT AUTO_INCREMENT PRIMARY KEY,
        startup_id INT NOT NULL,
        investor_id INT NOT NULL,
        round_id INT NOT NULL,
        proposed_by ENUM('STARTUP','INVESTOR') NOT NULL,
        amount_offered DECIMAL(15,2) NOT NULL,
        equity_percentage DECIMAL(5,2) NOT NULL,
        valuation_expected DECIMAL(15,2) NULL,
        status ENUM('PROPOSED','COUNTER_OFFERED','ACCEPTED','REJECTED') DEFAULT 'PROPOSED',
        terms TEXT,
        round_number INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_negotiation_startup
          FOREIGN KEY (startup_id) REFERENCES startup(startup_id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_negotiation_investor
          FOREIGN KEY (investor_id) REFERENCES investor(investor_id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_negotiation_round
          FOREIGN KEY (round_id) REFERENCES funding_round(round_id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS negotiation_audit (
        audit_id INT AUTO_INCREMENT PRIMARY KEY,
        negotiation_id INT NOT NULL,
        old_status VARCHAR(20),
        new_status VARCHAR(20),
        old_amount DECIMAL(15,2),
        new_amount DECIMAL(15,2),
        old_equity DECIMAL(5,2),
        new_equity DECIMAL(5,2),
        round_number INT,
        action_type VARCHAR(30),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_audit_negotiation
          FOREIGN KEY (negotiation_id) REFERENCES negotiation(negotiation_id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB;
    `);
    tableChecked = true;
  } catch (err) {
    console.warn('Could not auto-create negotiation table (it may already exist or DB is offline):', err);
  }
}

export async function getMongoNegotiationThread(negotiationId: number) {
  try {
    const db = await mongoDb();
    const thread = await db.collection('negotiation_threads').findOne({ negotiation_id: negotiationId });
    return thread;
  } catch (err) {
    console.error('Failed to read negotiation thread from MongoDB:', err);
    return null;
  }
}

export async function addMongoNegotiationEvent(negotiationId: number, event: {
  round_number?: number;
  author_role?: string;
  author_name?: string;
  amount_offered?: number;
  equity_percentage?: number;
  action: 'PROPOSED' | 'COUNTER_OFFERED' | 'ACCEPTED' | 'REJECTED';
  note: string;
}) {
  try {
    const db = await mongoDb();
    const payload = {
      ...event,
      timestamp: new Date()
    };
    await db.collection('negotiation_threads').updateOne(
      { negotiation_id: negotiationId },
      {
        $push: { events: payload } as any,
        $setOnInsert: { negotiation_id: negotiationId, createdAt: new Date() }
      },
      { upsert: true }
    );
  } catch (err) {
    console.error('Failed to log negotiation event to MongoDB:', err);
  }
}
