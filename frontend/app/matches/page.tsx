'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

export default function Matches() {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [hasPreferences, setHasPreferences] = useState(true);
  const [role, setRole] = useState<string>('INVESTOR');

  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);

  // Investment form
  const [showInvestForm, setShowInvestForm] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);

  const [investing, setInvesting] = useState(false);

  const [investmentForm, setInvestmentForm] = useState({
    amount_invested: '',
    equity_percentage: '',
    investment_date: new Date().toLocaleDateString('en-CA'),
    terms: ''
  });

  // Negotiation state
  const [showNegotiateModal, setShowNegotiateModal] = useState(false);
  const [negotiating, setNegotiating] = useState(false);
  const [negotiateForm, setNegotiateForm] = useState({
    amount_offered: '',
    equity_percentage: '',
    terms: '',
    initial_note: '',
    proposed_by: 'INVESTOR'
  });

  function openNegotiateModal(match: any) {
    if (!match.round_id) {
      setMsg('This startup does not have an OPEN funding round.');
      return;
    }
    setSelectedMatch(match);
    setNegotiateForm({
      amount_offered: match.amount_required ? String(match.amount_required) : '',
      equity_percentage: '10',
      terms: 'Standard term sheet with quarterly investor updates and observer rights.',
      initial_note: `Term sheet negotiation initiated for ${match.round_name || 'funding round'}.`,
      proposed_by: 'INVESTOR'
    });
    setShowNegotiateModal(true);
    setMsg('');
  }

  async function submitNegotiation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedMatch) return;

    const amount = Number(negotiateForm.amount_offered);
    const equity = Number(negotiateForm.equity_percentage);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMsg('Enter a valid offered amount.');
      return;
    }
    if (!Number.isFinite(equity) || equity <= 0 || equity > 100) {
      setMsg('Equity percentage must be between 0 and 100.');
      return;
    }

    setNegotiating(true);
    setMsg('');

    try {
      const response = await fetch('/api/negotiations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startup_id: selectedMatch.startup_id,
          investor_id: selectedMatch.investor_id,
          round_id: selectedMatch.round_id,
          proposed_by: negotiateForm.proposed_by || 'INVESTOR',
          amount_offered: amount,
          equity_percentage: equity,
          terms: negotiateForm.terms,
          initial_note: negotiateForm.initial_note
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to initiate negotiation.');
      }

      setMsg('Negotiation initiated successfully! You can track and counter-offer on the Negotiations page.');
      setShowNegotiateModal(false);
      setSelectedMatch(null);
    } catch (error: any) {
      setMsg(error.message);
    } finally {
      setNegotiating(false);
    }
  }

  // Load matches
  async function load() {
    try {
      const response = await fetch('/api/match');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load matches.');
      }

      if (Array.isArray(data)) {
        setRows(data);
        setHasPreferences(true);
      } else {
        setRows(data.matches || []);
        setHasPreferences(data.hasPreferences !== false);
        if (data.role) setRole(data.role);
        if (data.message && (!data.matches || data.matches.length === 0)) {
          setMsg(data.message);
        }
      }
    } catch (error: any) {
      setMsg(error.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Run matching engine
  async function run() {
    if (!hasPreferences && role === 'INVESTOR') {
      setMsg('Please configure your investment preferences first (industry, stage, or ticket size) before running the matching engine.');
      return;
    }

    setBusy(true);
    setMsg('Calculating startup-investor compatibility...');

    try {
      const response = await fetch('/api/match', {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.needsPreferences) {
          setHasPreferences(false);
        }
        throw new Error(data.error || 'Matching failed.');
      }

      setMsg(data.message);
      await load();
    } catch (error: any) {
      setMsg(error.message);
    } finally {
      setBusy(false);
    }
  }

  // Accept or reject match

  async function updateMatch(
    matchId: number,
    status: 'ACCEPTED' | 'REJECTED'
  ) {
    const action = status === 'ACCEPTED' ? 'accept' : 'reject';

    if (!window.confirm(`Are you sure you want to ${action} this match?`)) {
      return;
    }

    setUpdating(matchId);
    setMsg('');

    try {
      const response = await fetch(`/api/match/${matchId}`, {
        method: 'PATCH',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({ status })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to update match.');
      }

      setMsg(data.message);

      await load();

    } catch (error: any) {
      setMsg(error.message);

    } finally {
      setUpdating(null);
    }
  }

  // Open investment form

  function openInvestForm(match: any) {
    if (!match.round_id) {
      setMsg('This startup does not have an OPEN funding round.');
      return;
    }

    setSelectedMatch(match);

    setInvestmentForm({
      amount_invested: '',
      equity_percentage: '',
      investment_date: new Date().toLocaleDateString('en-CA'),
      terms: ''
    });

    setShowInvestForm(true);
    setMsg('');
  }

  // Submit investment

  async function submitInvestment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedMatch) {
      return;
    }

    const amount = Number(investmentForm.amount_invested);

    const equity = investmentForm.equity_percentage === ''
      ? null
      : Number(investmentForm.equity_percentage);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMsg('Enter a valid investment amount.');
      return;
    }

    if (
      equity !== null &&
      (!Number.isFinite(equity) || equity < 0 || equity > 100)
    ) {
      setMsg('Equity percentage must be between 0 and 100.');
      return;
    }

    setInvesting(true);
    setMsg('');

    try {
      const response = await fetch('/api/data', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          type: 'investments',

          round_id: selectedMatch.round_id,
          investor_id: selectedMatch.investor_id,

          amount_invested: amount,
          equity_percentage: equity,

          investment_date: investmentForm.investment_date,

          terms: investmentForm.terms
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to save investment.');
      }

      setMsg(
        `Investment successfully recorded for ${selectedMatch.startup_name}.`
      );

      setShowInvestForm(false);
      setSelectedMatch(null);

    } catch (error: any) {
      setMsg(error.message);

    } finally {
      setInvesting(false);
    }
  }

  // Score color

  function scoreColor(score: number) {
    if (score >= 80) return '#16a34a';
    if (score >= 65) return '#2563eb';
    if (score >= 50) return '#d97706';

    return '#dc2626';
  }

  return (
    <AppShell userName="Workspace">

      <div className="content">

        <div className="eyebrow">
          INTELLIGENT DISCOVERY
        </div>

        <h1 className="title">
          Investor Matching
        </h1>

        <p className="subtitle">
          Discover suitable investors and startups using
          industry compatibility, funding stages and
          investment preferences.
        </p>

        {/* Matching Engine */}

        <div className="panel">

          <div className="sectionhead">

            <div>
              <h2>Weighted Matching Engine</h2>

              <p className="muted">
                Industry fit · Funding stage ·
                Investment ticket · Base score
              </p>
            </div>

            {role !== 'STARTUP' && (
              <button
                className="btn"
                onClick={run}
                disabled={busy}
              >
                {busy ? 'Running...' : 'Run Matching'}
              </button>
            )}

          </div>

          {msg && (
            <div className="notice">
              {msg}
            </div>
          )}

        </div>

        {/* Missing Preferences Warning Banner */}
        {!hasPreferences && role === 'INVESTOR' && (
          <div
            style={{
              marginTop: 20,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 12,
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              alignItems: 'center',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 36 }}>⚙️</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#92400e', margin: 0 }}>
              Investment Preferences Required
            </h3>
            <p style={{ color: '#b45309', maxWidth: 540, margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              You have not configured your investment preferences yet. The AI matching algorithm requires your target industry, funding stage, or ticket size to compute compatible startup fits.
            </p>
            <Link
              href="/preferences"
              className="btn"
              style={{
                background: '#d97706',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 600,
                padding: '10px 22px',
                borderRadius: 8,
                marginTop: 4
              }}
            >
              Configure Investment Preferences →
            </Link>
          </div>
        )}

        {/* Statistics */}

        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            marginTop: 24
          }}
        >

          <div className="panel">
            <p className="muted">Total Matches</p>
            <h2>{rows.length}</h2>
          </div>

          <div className="panel">
            <p className="muted">Strong Matches</p>

            <h2>
              {rows.filter(
                r => Number(r.match_score) >= 80
              ).length}
            </h2>
          </div>

          <div className="panel">
            <p className="muted">Average Match Score</p>

            <h2>
              {rows.length
                ? (
                    rows.reduce(
                      (sum, r) => sum + Number(r.match_score),
                      0
                    ) / rows.length
                  ).toFixed(1) + '%'
                : '0%'}
            </h2>
          </div>

        </div>

        {/* Ranked Matches */}

        <div className="section">

          <div className="sectionhead">
            <h2>Ranked Matches</h2>

            <span className="muted">
              {rows.length} results
            </span>
          </div>

          <div className="tablewrap">

            <table>

              <thead>
                <tr>
                  <th>Startup</th>
                  <th>Investor</th>
                  <th>Match Score</th>
                  <th>Status</th>
                  <th>Action</th>
                  <th>Matched Date</th>
                </tr>
              </thead>

              <tbody>

                {rows.length ? rows.map((r) => (

                  <tr key={r.match_id}>

                    <td>
                      <b>{r.startup_name}</b>

                      <br />

                      <small className="muted">
                        {r.funding_stage || 'Stage not specified'}
                      </small>

                      {r.round_name && (
                        <>
                          <br />
                          <small className="muted">
                            {r.round_name}
                          </small>
                        </>
                      )}
                    </td>

                    <td>
                      {r.firm_name}
                    </td>

                    <td style={{ minWidth: 130 }}>

                      <b
                        style={{
                          color: scoreColor(Number(r.match_score))
                        }}
                      >
                        {Number(r.match_score).toFixed(1)}%
                      </b>

                      <div
                        style={{
                          height: 7,
                          background: '#e5e7eb',
                          borderRadius: 10,
                          marginTop: 7
                        }}
                      >

                        <div
                          style={{
                            width: `${Math.min(100, Number(r.match_score))}%`,
                            height: '100%',
                            background: scoreColor(Number(r.match_score)),
                            borderRadius: 10
                          }}
                        />

                      </div>

                    </td>

                    <td>
                      <span className="pill">
                        {r.status}
                      </span>
                    </td>

                    <td>

                      {r.status === 'PENDING' ? (

                        <div
                          style={{
                            display: 'flex',
                            gap: 6
                          }}
                        >

                          <button
                            onClick={() => updateMatch(r.match_id, 'ACCEPTED')}
                            disabled={updating !== null}
                            style={{
                              background: '#16a34a',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              padding: '7px 10px',
                              cursor: 'pointer'
                            }}
                          >
                            {updating === r.match_id ? '...' : 'Accept'}
                          </button>

                          <button
                            onClick={() => updateMatch(r.match_id, 'REJECTED')}
                            disabled={updating !== null}
                            style={{
                              background: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              padding: '7px 10px',
                              cursor: 'pointer'
                            }}
                          >
                            {updating === r.match_id ? '...' : 'Reject'}
                          </button>

                        </div>

                      ) : r.status === 'ACCEPTED' ? (

                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => openNegotiateModal(r)}
                            disabled={!r.round_id}
                            style={{
                              background: r.round_id ? '#4f46e5' : '#9ca3af',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              padding: '7px 11px',
                              fontWeight: 600,
                              cursor: r.round_id ? 'pointer' : 'not-allowed'
                            }}
                          >
                            Negotiate
                          </button>

                          <button
                            onClick={() => openInvestForm(r)}
                            disabled={!r.round_id}
                            style={{
                              background: r.round_id ? '#2563eb' : '#9ca3af',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              padding: '7px 11px',
                              cursor: r.round_id ? 'pointer' : 'not-allowed'
                            }}
                          >
                            Direct Invest
                          </button>
                        </div>

                      ) : (

                        <span className="muted">
                          Decision recorded
                        </span>

                      )}

                    </td>

                    <td>
                      {String(r.matched_date).slice(0, 10)}
                    </td>

                  </tr>

                )) : (

                  <tr>
                    <td colSpan={6} className="empty" style={{ textAlign: 'center', padding: '36px 16px' }}>
                      {!hasPreferences && role === 'INVESTOR' ? (
                        <div>
                          <p style={{ fontWeight: 600, color: '#92400e', marginBottom: 6 }}>
                            ⚠️ No matches generated because your investment preferences are not set.
                          </p>
                          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>
                            Define your target sector, funding stage, and ticket size range to find matching startups.
                          </p>
                          <Link
                            href="/preferences"
                            className="btn"
                            style={{
                              background: '#4f46e5',
                              color: '#fff',
                              padding: '8px 18px',
                              fontSize: 13,
                              textDecoration: 'none',
                              display: 'inline-block'
                            }}
                          >
                            Set Preferences Now →
                          </Link>
                        </div>
                      ) : (
                        <div>
                          <p style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                            No matches calculated yet.
                          </p>
                          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
                            Click <b>"Run Matching"</b> above to score and rank compatible startups.
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>

                )}

              </tbody>

            </table>

          </div>

        </div>

        {/* Investment Form */}

        {showInvestForm && selectedMatch && (

          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              padding: 20
            }}
          >

            <div
              className="panel"
              style={{
                width: '100%',
                maxWidth: 550,
                maxHeight: '90vh',
                overflowY: 'auto'
              }}
            >

              <div className="sectionhead">

                <div>
                  <h2>Record Investment</h2>

                  <p className="muted">
                    {selectedMatch.startup_name}
                  </p>

                  <p className="muted">
                    {selectedMatch.round_name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowInvestForm(false)}
                  disabled={investing}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 24,
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>

              </div>

              <form onSubmit={submitInvestment}>

                <div style={{ marginBottom: 16 }}>

                  <label>
                    Investment Amount (₹)
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={investmentForm.amount_invested}
                    onChange={(e) =>
                      setInvestmentForm({
                        ...investmentForm,
                        amount_invested: e.target.value
                      })
                    }
                    placeholder="Enter investment amount"
                    style={{
                      width: '100%',
                      padding: 10,
                      marginTop: 6
                    }}
                  />

                </div>

                <div style={{ marginBottom: 16 }}>

                  <label>
                    Equity Percentage (%)
                  </label>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={investmentForm.equity_percentage}
                    onChange={(e) =>
                      setInvestmentForm({
                        ...investmentForm,
                        equity_percentage: e.target.value
                      })
                    }
                    placeholder="Optional"
                    style={{
                      width: '100%',
                      padding: 10,
                      marginTop: 6
                    }}
                  />

                </div>

                <div style={{ marginBottom: 16 }}>

                  <label>
                    Investment Date
                  </label>

                  <input
                    type="date"
                    required
                    value={investmentForm.investment_date}
                    onChange={(e) =>
                      setInvestmentForm({
                        ...investmentForm,
                        investment_date: e.target.value
                      })
                    }
                    style={{
                      width: '100%',
                      padding: 10,
                      marginTop: 6
                    }}
                  />

                </div>

                <div style={{ marginBottom: 20 }}>

                  <label>
                    Investment Terms
                  </label>

                  <textarea
                    value={investmentForm.terms}
                    onChange={(e) =>
                      setInvestmentForm({
                        ...investmentForm,
                        terms: e.target.value
                      })
                    }
                    placeholder="Enter investment terms (optional)"
                    rows={4}
                    style={{
                      width: '100%',
                      padding: 10,
                      marginTop: 6,
                      resize: 'vertical'
                    }}
                  />

                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    justifyContent: 'flex-end'
                  }}
                >

                  <button
                    type="button"
                    onClick={() => setShowInvestForm(false)}
                    disabled={investing}
                    className="btn"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn"
                    disabled={investing}
                  >
                    {investing ? 'Saving...' : 'Save Investment'}
                  </button>

                </div>

              </form>

            </div>

          </div>

        )}

        {/* Negotiation Modal */}

        {showNegotiateModal && selectedMatch && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              padding: 20
            }}
          >
            <div
              className="panel"
              style={{
                width: '100%',
                maxWidth: 580,
                maxHeight: '90vh',
                overflowY: 'auto'
              }}
            >
              <div className="sectionhead">
                <div>
                  <h2>Initiate Deal Negotiation</h2>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    <b>{selectedMatch.startup_name}</b> ↔ <b>{selectedMatch.firm_name}</b>
                  </p>
                  <p className="muted" style={{ fontSize: 13, margin: '2px 0 0' }}>
                    Funding Round: {selectedMatch.round_name || 'Open Round'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNegotiateModal(false)}
                  disabled={negotiating}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 24,
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={submitNegotiation} style={{ marginTop: 14 }}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Proposed By</label>
                  <select
                    value={negotiateForm.proposed_by}
                    onChange={(e) => setNegotiateForm({ ...negotiateForm, proposed_by: e.target.value })}
                    style={{ width: '100%', padding: 10, marginTop: 6, borderRadius: 8, border: '1px solid #dfe4ec' }}
                  >
                    <option value="INVESTOR">Investor ({selectedMatch.firm_name})</option>
                    <option value="STARTUP">Startup Founder ({selectedMatch.startup_name})</option>
                  </select>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Proposed Investment Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={negotiateForm.amount_offered}
                    onChange={(e) => setNegotiateForm({ ...negotiateForm, amount_offered: e.target.value })}
                    placeholder="e.g. 2500000"
                    style={{ width: '100%', padding: 10, marginTop: 6, borderRadius: 8, border: '1px solid #dfe4ec' }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Equity Requested (%)</label>
                  <input
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    required
                    value={negotiateForm.equity_percentage}
                    onChange={(e) => setNegotiateForm({ ...negotiateForm, equity_percentage: e.target.value })}
                    placeholder="e.g. 7.5"
                    style={{ width: '100%', padding: 10, marginTop: 6, borderRadius: 8, border: '1px solid #dfe4ec' }}
                  />
                </div>

                {Number(negotiateForm.amount_offered) > 0 && Number(negotiateForm.equity_percentage) > 0 && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                    <span style={{ color: '#166534', fontWeight: 600 }}>Implied Pre-Money Valuation: </span>
                    <b style={{ color: '#15803d' }}>
                      ₹{((Number(negotiateForm.amount_offered) / (Number(negotiateForm.equity_percentage) / 100))).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </b>
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Proposed Terms / Conditions</label>
                  <textarea
                    value={negotiateForm.terms}
                    onChange={(e) => setNegotiateForm({ ...negotiateForm, terms: e.target.value })}
                    placeholder="Board seats, investor rights, milestone tranches..."
                    rows={3}
                    style={{ width: '100%', padding: 10, marginTop: 6, borderRadius: 8, border: '1px solid #dfe4ec', resize: 'vertical' }}
                  />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Initial Proposal Note (MongoDB Audit & Timeline)</label>
                  <textarea
                    value={negotiateForm.initial_note}
                    onChange={(e) => setNegotiateForm({ ...negotiateForm, initial_note: e.target.value })}
                    placeholder="Provide context or pitch rationale for this initial offer..."
                    rows={2}
                    style={{ width: '100%', padding: 10, marginTop: 6, borderRadius: 8, border: '1px solid #dfe4ec', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowNegotiateModal(false)}
                    disabled={negotiating}
                    className="btn secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn"
                    disabled={negotiating}
                    style={{ background: '#4f46e5' }}
                  >
                    {negotiating ? 'Submitting...' : 'Submit Proposal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Why These Matches */}
        {rows.length > 0 && (
          <div className="section">
            <h2>Why These Matches?</h2>
            <p className="muted">
              The following breakdown explains the
              compatibility calculation for each match.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 16
              }}
            >
              {rows.map((r) => (
                <div className="panel" key={r.match_id}>
                  <h3>{r.startup_name}</h3>
                  <p className="muted">Investor: {r.firm_name}</p>
                  <h2 style={{ color: scoreColor(Number(r.match_score)) }}>
                    {Number(r.match_score).toFixed(1)}%
                  </h2>
                  <hr />
                  <p>Base score: {r.breakdown?.base ?? 0}</p>
                  <p>Industry: {r.breakdown?.industry ?? 0}</p>
                  <p>Funding stage: {r.breakdown?.stage ?? 0}</p>
                  <p>Investment ticket: {r.breakdown?.ticket ?? 0}</p>
                  <hr />
                  <b>Compatibility Details</b>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
                    {(r.reasons || []).map((reason: string, index: number) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

    </AppShell>
  );
}