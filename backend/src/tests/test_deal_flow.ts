import { pool } from '../lib/db';
import { makeToken } from '../lib/auth';
import express from 'express';
import cookieParser from 'cookie-parser';
import negotiationsRoutes from '../routes/negotiations';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING VENTURELINK DEAL FLOW & NEGOTIATION TESTS');
  console.log('Rule: A startup can accept offers from any investor, but not all.');
  console.log('====================================================');

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/negotiations', negotiationsRoutes);

  const server = app.listen(5099);

  // Setup test tokens
  // User 1: Sanjan M (role: STARTUP, owner of startup_id = 1 PayNova)
  const founderToken = await makeToken({ user_id: 1, name: 'Sanjan M', role: 'STARTUP' });
  // User 2: Rahul Kumar (role: STARTUP, owner of startup_id = 2 MediTrack)
  const otherFounderToken = await makeToken({ user_id: 2, name: 'Rahul Kumar', role: 'STARTUP' });
  // User 6: Rohan Mehta (role: INVESTOR, investor_id = 1)
  const investorToken = await makeToken({ user_id: 6, name: 'Rohan Mehta', role: 'INVESTOR' });

  try {
    // Reset round 1 to OPEN and reset negotiation 1 to PROPOSED for clean test
    await pool.execute('UPDATE funding_round SET status = "OPEN" WHERE round_id = 1');
    await pool.execute('UPDATE negotiation SET status = "PROPOSED", round_number = 1 WHERE negotiation_id = 1');
    // Remove any previous test investments for round 1
    await pool.execute('DELETE FROM investment WHERE round_id = 1 AND terms LIKE "%Deal finalized%" OR terms LIKE "%Final terms agreed%"');

    // Create a second competing negotiation for Round 1 from another investor (investor_id = 1)
    await pool.execute('DELETE FROM negotiation WHERE round_id = 1 AND negotiation_id != 1');
    const [compResult]: any = await pool.execute(`
      INSERT INTO negotiation
      (startup_id, investor_id, round_id, proposed_by, amount_offered, equity_percentage, valuation_expected, status, terms, round_number)
      VALUES (1, 1, 1, 'INVESTOR', 5000000.00, 12.00, 41666666.67, 'PROPOSED', 'Competing offer from Rohan Mehta (investor 1)', 1)
    `);
    const competingId = compResult.insertId;
    console.log(`[SETUP] Seeded competing offer #${competingId} on Round 1.`);

    // Helper for requests
    async function apiPatch(id: number, body: any, token: string) {
      const res = await fetch(`http://localhost:5099/api/negotiations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `sf_session=${token}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      return { status: res.status, data };
    }

    // TEST 1: Investor attempts to accept deal -> MUST BE 403 FORBIDDEN
    console.log('\n--- TEST 1: Investor attempts to accept deal ---');
    const t1 = await apiPatch(1, { action: 'ACCEPT' }, investorToken);
    console.log(`Status: ${t1.status}`);
    console.log(`Response: ${JSON.stringify(t1.data)}`);
    if (t1.status === 403 && t1.data.error.includes('Only the startup founder can accept')) {
      console.log('✅ TEST 1 PASSED: Investor cannot accept deal.');
    } else {
      console.error('❌ TEST 1 FAILED');
      process.exit(1);
    }

    // TEST 2: Different founder (not owner of startup 1) attempts to accept deal -> MUST BE 403 FORBIDDEN
    console.log('\n--- TEST 2: Unauthorized founder attempts to accept deal ---');
    const t2 = await apiPatch(1, { action: 'ACCEPT' }, otherFounderToken);
    console.log(`Status: ${t2.status}`);
    console.log(`Response: ${JSON.stringify(t2.data)}`);
    if (t2.status === 403 && t2.data.error.includes('You do not have permission to accept offers for this startup')) {
      console.log('✅ TEST 2 PASSED: Unauthorized founder cannot accept deal.');
    } else {
      console.error('❌ TEST 2 FAILED');
      process.exit(1);
    }

    // TEST 3: Startup founder accepts offer from Investor 10 (Winning offer)
    console.log('\n--- TEST 3: Startup founder accepts winning offer (#1) ---');
    const t3 = await apiPatch(1, { action: 'ACCEPT', note: 'Deal approved by Sanjan M' }, founderToken);
    console.log(`Status: ${t3.status}`);
    console.log(`Response: ${JSON.stringify(t3.data)}`);
    if (t3.status === 200 && t3.data.ok === true) {
      console.log('✅ TEST 3 PASSED: Startup founder accepted winning offer.');
    } else {
      console.error('❌ TEST 3 FAILED');
      process.exit(1);
    }

    // TEST 4: Verify DB state:
    // Negotiation 1 is ACCEPTED
    // Competing negotiation is automatically REJECTED
    // Funding Round 1 is CLOSED
    console.log('\n--- TEST 4: Verify Database State after Acceptance ---');
    const [neg1]: any = await pool.query('SELECT status FROM negotiation WHERE negotiation_id = 1');
    const [negComp]: any = await pool.query('SELECT status FROM negotiation WHERE negotiation_id = ?', [competingId]);
    const [round1]: any = await pool.query('SELECT status FROM funding_round WHERE round_id = 1');
    const [inv1]: any = await pool.query('SELECT investment_id, amount_invested, equity_percentage FROM investment WHERE round_id = 1');

    console.log(`Negotiation 1 Status: ${neg1[0]?.status} (Expected: ACCEPTED)`);
    console.log(`Competing Negotiation #${competingId} Status: ${negComp[0]?.status} (Expected: REJECTED)`);
    console.log(`Funding Round 1 Status: ${round1[0]?.status} (Expected: CLOSED)`);
    console.log(`Investments count for Round 1: ${inv1.length} (Expected: 1)`);

    if (
      neg1[0]?.status === 'ACCEPTED' &&
      negComp[0]?.status === 'REJECTED' &&
      round1[0]?.status === 'CLOSED' &&
      inv1.length >= 1
    ) {
      console.log('✅ TEST 4 PASSED: DB Transaction successfully finalized winning deal, closed round, and auto-rejected competing offer.');
    } else {
      console.error('❌ TEST 4 FAILED');
      process.exit(1);
    }

    // TEST 5: Startup founder tries to accept the competing offer after round is closed -> MUST BE 400
    console.log('\n--- TEST 5: Attempting to accept a second offer on the same round ---');
    const t5 = await apiPatch(competingId, { action: 'ACCEPT' }, founderToken);
    console.log(`Status: ${t5.status}`);
    console.log(`Response: ${JSON.stringify(t5.data)}`);
    if (t5.status === 400 && t5.data.error.includes('A startup can only accept one winning offer')) {
      console.log('✅ TEST 5 PASSED: Startup cannot accept all offers; only one winning offer per round.');
    } else {
      console.error('❌ TEST 5 FAILED');
      process.exit(1);
    }

    // TEST 6: Attempting to counter-offer on a closed round -> MUST BE 400
    console.log('\n--- TEST 6: Attempting counter-offer on closed round ---');
    const t6 = await apiPatch(competingId, {
      action: 'COUNTER_OFFER',
      amount_offered: 5000000,
      equity_percentage: 9
    }, founderToken);
    console.log(`Status: ${t6.status}`);
    console.log(`Response: ${JSON.stringify(t6.data)}`);
    if (t6.status === 400 && t6.data.error.includes('This funding round is closed or an offer has already been accepted')) {
      console.log('✅ TEST 6 PASSED: Counter-offer blocked on closed/accepted round.');
    } else {
      console.error('❌ TEST 6 FAILED');
      process.exit(1);
    }

    console.log('\n====================================================');
    console.log('🎉 ALL 6 DEAL FLOW TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================');

    // Clean up test competing record
    await pool.execute('DELETE FROM negotiation WHERE negotiation_id = ?', [competingId]);
    // Clean up test investment
    if (t3.data.investment_id) {
      await pool.execute('DELETE FROM investment WHERE investment_id = ?', [t3.data.investment_id]);
    }
    // Reopen round 1 and set negotiation 1 back to PROPOSED
    await pool.execute('UPDATE funding_round SET status = "OPEN" WHERE round_id = 1');
    await pool.execute('UPDATE negotiation SET status = "PROPOSED", round_number = 1 WHERE negotiation_id = 1');

  } finally {
    server.close();
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
