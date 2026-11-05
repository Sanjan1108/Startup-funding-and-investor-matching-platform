'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';

export default function Matches() {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

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

  // Load matches

  async function load() {
    try {
      const response = await fetch('/api/match');

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load matches.');
      }

      setRows(Array.isArray(data) ? data : []);

    } catch (error: any) {
      setMsg(error.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Run matching engine

  async function run() {
    setBusy(true);

    setMsg('Calculating startup-investor compatibility...');

    try {
      const response = await fetch('/api/match', {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
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

            <button
              className="btn"
              onClick={run}
              disabled={busy}
            >
              {busy ? 'Running...' : 'Run Matching'}
            </button>

          </div>

          {msg && (
            <div className="notice">
              {msg}
            </div>
          )}

        </div>

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

                        <button
                          onClick={() => openInvestForm(r)}
                          disabled={!r.round_id}
                          style={{
                            background: r.round_id ? '#2563eb' : '#9ca3af',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            padding: '8px 12px',
                            cursor: r.round_id ? 'pointer' : 'not-allowed'
                          }}
                        >
                          Invest
                        </button>

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
                    <td colSpan={6} className="empty">
                      No matches available.
                      Run the matching engine to generate results.
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

        {/* Why These Matches */}

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

                <h3>
                  {r.startup_name}
                </h3>

                <p className="muted">
                  Investor: {r.firm_name}
                </p>

                <h2
                  style={{
                    color: scoreColor(Number(r.match_score))
                  }}
                >
                  {Number(r.match_score).toFixed(1)}%
                </h2>

                <hr />

                <p>
                  Base score: {r.breakdown?.base ?? 0}
                </p>

                <p>
                  Industry: {r.breakdown?.industry ?? 0}
                </p>

                <p>
                  Funding stage: {r.breakdown?.stage ?? 0}
                </p>

                <p>
                  Investment ticket: {r.breakdown?.ticket ?? 0}
                </p>

                <hr />

                <b>
                  Compatibility Details
                </b>

                <ul
                  style={{
                    paddingLeft: 20,
                    lineHeight: 1.8
                  }}
                >

                  {(r.reasons || []).map(
                    (reason: string, index: number) => (
                      <li key={index}>
                        {reason}
                      </li>
                    )
                  )}

                </ul>

              </div>

            ))}

          </div>

        </div>

      </div>

    </AppShell>
  );
}