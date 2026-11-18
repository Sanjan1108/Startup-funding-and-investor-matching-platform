'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';

interface NegotiationItem {
  negotiation_id: number;
  startup_id: number;
  investor_id: number;
  round_id: number;
  proposed_by: 'STARTUP' | 'INVESTOR';
  amount_offered: number;
  equity_percentage: number;
  valuation_expected: number | null;
  status: 'PROPOSED' | 'COUNTER_OFFERED' | 'ACCEPTED' | 'REJECTED';
  terms: string | null;
  round_number: number;
  created_at: string;
  updated_at: string;
  startup_name: string;
  funding_stage: string;
  firm_name: string;
  round_name: string;
  amount_required: number;
  round_status: string;
  implied_valuation: number | null;
  latest_note?: string;
  timeline_count?: number;
}

interface TimelineEvent {
  round_number?: number;
  author_role?: string;
  author_name?: string;
  amount_offered?: number;
  equity_percentage?: number;
  action: 'PROPOSED' | 'COUNTER_OFFERED' | 'ACCEPTED' | 'REJECTED';
  note: string;
  timestamp: string;
}

function formatINR(val: any) {
  const num = Number(val);
  if (!Number.isFinite(num)) return '₹0';
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function NegotiationsPage() {
  const [items, setItems] = useState<NegotiationItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'ACCEPTED' | 'REJECTED'>('ALL');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Form options
  const [startups, setStartups] = useState<any[]>([]);
  const [investors, setInvestors] = useState<any[]>([]);
  const [fundingRounds, setFundingRounds] = useState<any[]>([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [activeItem, setActiveItem] = useState<NegotiationItem | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    startup_id: '',
    investor_id: '',
    round_id: '',
    proposed_by: 'INVESTOR',
    amount_offered: '',
    equity_percentage: '',
    terms: 'Standard term sheet with quarterly financial reporting and board observer seat.',
    initial_note: 'Initial funding proposal submitted.'
  });

  const [counterForm, setCounterForm] = useState({
    amount_offered: '',
    equity_percentage: '',
    terms: '',
    note: '',
    proposed_by: 'STARTUP'
  });

  const [acceptForm, setAcceptForm] = useState({
    investment_date: new Date().toISOString().split('T')[0],
    terms: '',
    note: 'Deal terms approved and finalized.'
  });

  const [submitting, setSubmitting] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/negotiations');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load negotiations.');
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function loadOptions() {
    try {
      const res = await fetch('/api/negotiations?options=1');
      const data = await res.json();
      if (res.ok) {
        setStartups(data.startups || []);
        setInvestors(data.investors || []);
        setFundingRounds(data.fundingRounds || []);
      }
    } catch {
      // Options will retry on modal open
    }
  }

  useEffect(() => {
    loadData();
    loadOptions();
  }, []);

  // Filtered list
  const filtered = items.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return item.status === 'PROPOSED' || item.status === 'COUNTER_OFFERED';
    if (filter === 'ACCEPTED') return item.status === 'ACCEPTED';
    if (filter === 'REJECTED') return item.status === 'REJECTED';
    return true;
  });

  // Calculate stats
  const totalCount = items.length;
  const activeCount = items.filter(i => i.status === 'PROPOSED' || i.status === 'COUNTER_OFFERED').length;
  const acceptedCount = items.filter(i => i.status === 'ACCEPTED').length;
  const rejectedCount = items.filter(i => i.status === 'REJECTED').length;
  const totalCommitted = items
    .filter(i => i.status === 'ACCEPTED')
    .reduce((sum, i) => sum + Number(i.amount_offered || 0), 0);

  // Open Create Modal
  function handleOpenCreate() {
    loadOptions();
    setCreateForm({
      startup_id: startups[0]?.startup_id ? String(startups[0].startup_id) : '',
      investor_id: investors[0]?.investor_id ? String(investors[0].investor_id) : '',
      round_id: fundingRounds[0]?.round_id ? String(fundingRounds[0].round_id) : '',
      proposed_by: 'INVESTOR',
      amount_offered: fundingRounds[0]?.amount_required ? String(fundingRounds[0].amount_required) : '',
      equity_percentage: '8.0',
      terms: 'Standard term sheet with quarterly investor updates and observer rights.',
      initial_note: 'Initial funding term sheet submitted.'
    });
    setShowCreateModal(true);
    setMsg(null);
  }

  // Submit Create
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/negotiations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit negotiation.');
      setMsg({ type: 'ok', text: 'Negotiation proposal initiated successfully!' });
      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // Open Counter Modal
  function handleOpenCounter(item: NegotiationItem) {
    setActiveItem(item);
    setCounterForm({
      amount_offered: String(item.amount_offered),
      equity_percentage: String(item.equity_percentage),
      terms: item.terms || '',
      note: '',
      proposed_by: item.proposed_by === 'STARTUP' ? 'INVESTOR' : 'STARTUP'
    });
    setShowCounterModal(true);
    setMsg(null);
  }

  // Submit Counter
  async function handleCounter(e: React.FormEvent) {
    e.preventDefault();
    if (!activeItem) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/negotiations/${activeItem.negotiation_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COUNTER_OFFER',
          amount_offered: Number(counterForm.amount_offered),
          equity_percentage: Number(counterForm.equity_percentage),
          terms: counterForm.terms,
          note: counterForm.note,
          proposed_by: counterForm.proposed_by
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit counter-offer.');
      setMsg({ type: 'ok', text: data.message || 'Counter-offer submitted!' });
      setShowCounterModal(false);
      await loadData();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // Open Accept Modal
  function handleOpenAccept(item: NegotiationItem) {
    setActiveItem(item);
    setAcceptForm({
      investment_date: new Date().toISOString().split('T')[0],
      terms: item.terms || '',
      note: 'Deal terms mutually accepted! Recorded as finalized investment.'
    });
    setShowAcceptModal(true);
    setMsg(null);
  }

  // Submit Accept
  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!activeItem) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/negotiations/${activeItem.negotiation_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ACCEPT',
          investment_date: acceptForm.investment_date,
          terms: acceptForm.terms,
          note: acceptForm.note
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept negotiation.');
      setMsg({ type: 'ok', text: data.message || 'Deal terms accepted and finalized in Investments!' });
      setShowAcceptModal(false);
      await loadData();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // Reject
  async function handleReject(item: NegotiationItem) {
    const reason = window.prompt(`Please provide a reason for rejecting terms for ${item.startup_name}:`, 'Valuation or terms mismatch');
    if (reason === null) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/negotiations/${item.negotiation_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT',
          note: reason || 'Terms declined.'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject negotiation.');
      setMsg({ type: 'ok', text: 'Negotiation offer marked as rejected.' });
      await loadData();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // View Timeline
  async function handleOpenTimeline(item: NegotiationItem) {
    setActiveItem(item);
    setShowTimelineModal(true);
    setTimelineLoading(true);
    try {
      const res = await fetch(`/api/negotiations/${item.negotiation_id}`);
      const data = await res.json();
      if (res.ok && data.events) {
        setTimelineEvents(data.events);
      } else {
        setTimelineEvents([]);
      }
    } catch {
      setTimelineEvents([]);
    } finally {
      setTimelineLoading(false);
    }
  }

  // Status badge styling
  function renderStatusPill(status: string) {
    if (status === 'ACCEPTED') {
      return <span className="pill" style={{ background: '#dcfce7', color: '#15803d' }}>ACCEPTED</span>;
    }
    if (status === 'COUNTER_OFFERED') {
      return <span className="pill" style={{ background: '#e0e7ff', color: '#4338ca' }}>COUNTER-OFFER</span>;
    }
    if (status === 'PROPOSED') {
      return <span className="pill" style={{ background: '#fef3c7', color: '#b45309' }}>PROPOSED</span>;
    }
    return <span className="pill" style={{ background: '#fee2e2', color: '#b91c1c' }}>REJECTED</span>;
  }

  return (
    <AppShell userName="Workspace">
      <div className="content">
        <div className="eyebrow">DEAL CLOSING & TERM SHEETS</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="title">Deal Negotiations</h1>
            <p className="subtitle">
              Manage investment term sheets, counter-offers, equity splits, and close deals directly into official investments.
            </p>
          </div>
          <button className="btn" onClick={handleOpenCreate} style={{ padding: '11px 18px', fontWeight: 600 }}>
            + Start New Negotiation
          </button>
        </div>

        {msg && (
          <div className="notice" style={{ background: msg.type === 'ok' ? '#ecfdf5' : '#fef2f2', color: msg.type === 'ok' ? '#065f46' : '#991b1b', border: `1px solid ${msg.type === 'ok' ? '#a7f3d0' : '#fecaca'}` }}>
            {msg.text}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 24 }}>
          <div className="card">
            <div className="metriclabel">Total Negotiations</div>
            <div className="metric">{totalCount}</div>
            <div className="metriclabel">Across all rounds</div>
          </div>
          <div className="card">
            <div className="metriclabel">In Discussion</div>
            <div className="metric" style={{ color: '#2563eb' }}>{activeCount}</div>
            <div className="metriclabel">Active counter-offers</div>
          </div>
          <div className="card">
            <div className="metriclabel">Deals Closed (Accepted)</div>
            <div className="metric" style={{ color: '#16a34a' }}>{acceptedCount}</div>
            <div className="metriclabel">Converted to investments</div>
          </div>
          <div className="card">
            <div className="metriclabel">Capital Finalized</div>
            <div className="metric" style={{ color: '#0d9488' }}>{formatINR(totalCommitted)}</div>
            <div className="metriclabel">Agreed investment amount</div>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #e5e7eb', paddingBottom: 12 }}>
          {(['ALL', 'ACTIVE', 'ACCEPTED', 'REJECTED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                border: 'none',
                background: filter === tab ? '#14253d' : '#eef2f6',
                color: filter === tab ? '#ffffff' : '#4b5563',
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {tab === 'ALL' && `All (${totalCount})`}
              {tab === 'ACTIVE' && `In Progress (${activeCount})`}
              {tab === 'ACCEPTED' && `Accepted (${acceptedCount})`}
              {tab === 'REJECTED' && `Rejected (${rejectedCount})`}
            </button>
          ))}
        </div>

        {/* Negotiations Table */}
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Startup & Investor</th>
                <th>Funding Round</th>
                <th>Offered Terms</th>
                <th>Implied Valuation</th>
                <th>Round & Turn</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="empty">Loading negotiation records...</td>
                </tr>
              ) : filtered.length ? (
                filtered.map((item) => (
                  <tr key={item.negotiation_id}>
                    <td>
                      <b>{item.startup_name}</b>
                      <span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, marginLeft: 6, color: '#475569' }}>
                        {item.funding_stage || 'Stage'}
                      </span>
                      <br />
                      <small className="muted">Investor: {item.firm_name}</small>
                    </td>

                    <td>
                      <b>{item.round_name}</b>
                      <br />
                      <small className="muted">Seeking {formatINR(item.amount_required)}</small>
                    </td>

                    <td>
                      <b style={{ color: '#1e293b', fontSize: 14 }}>{formatINR(item.amount_offered)}</b>
                      <br />
                      <span style={{ color: '#4338ca', fontWeight: 600, fontSize: 12 }}>
                        for {Number(item.equity_percentage).toFixed(1)}% equity
                      </span>
                    </td>

                    <td>
                      {item.implied_valuation ? (
                        <b style={{ color: '#0f766e' }}>{formatINR(item.implied_valuation)}</b>
                      ) : (
                        <span className="muted">—</span>
                      )}
                      <br />
                      <small className="muted">Pre-money</small>
                    </td>

                    <td>
                      <span style={{ fontWeight: 600 }}>Round #{item.round_number}</span>
                      <br />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 12,
                          display: 'inline-block',
                          marginTop: 3,
                          background: item.proposed_by === 'STARTUP' ? '#e0f2fe' : '#f3e8ff',
                          color: item.proposed_by === 'STARTUP' ? '#0369a1' : '#6b21a8'
                        }}
                      >
                        {item.proposed_by === 'STARTUP' ? '🏢 By Startup' : '💼 By Investor'}
                      </span>
                      <br />
                      {(item.status === 'PROPOSED' || item.status === 'COUNTER_OFFERED') && (
                        <small style={{ color: '#64748b', fontSize: 11 }}>
                          ⏳ Awaiting {item.proposed_by === 'STARTUP' ? 'Investor' : 'Startup'}
                        </small>
                      )}
                    </td>

                    <td>
                      {renderStatusPill(item.status)}
                      {item.latest_note && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.latest_note}>
                          "{item.latest_note}"
                        </div>
                      )}
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(item.status === 'PROPOSED' || item.status === 'COUNTER_OFFERED') ? (
                          <>
                            <button
                              onClick={() => handleOpenCounter(item)}
                              disabled={submitting}
                              style={{
                                background: '#4338ca',
                                color: 'white',
                                border: 'none',
                                borderRadius: 6,
                                padding: '6px 10px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Counter
                            </button>
                            <button
                              onClick={() => handleOpenAccept(item)}
                              disabled={submitting}
                              style={{
                                background: '#16a34a',
                                color: 'white',
                                border: 'none',
                                borderRadius: 6,
                                padding: '6px 10px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleReject(item)}
                              disabled={submitting}
                              style={{
                                background: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: 6,
                                padding: '6px 10px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Reject
                            </button>
                          </>
                        ) : item.status === 'ACCEPTED' ? (
                          <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>✓ Investment Finalized</span>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>Deal Closed</span>
                        )}

                        <button
                          onClick={() => handleOpenTimeline(item)}
                          style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            padding: '6px 9px',
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer'
                          }}
                        >
                          Timeline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="empty">
                    No negotiations found under the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: Start New Negotiation */}
        {showCreateModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 }}>
            <div className="panel" style={{ width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="sectionhead">
                <div>
                  <h2>Initiate Deal Negotiation</h2>
                  <p className="muted">Propose initial valuation, equity ticket, and conditions.</p>
                </div>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ border: 'none', background: 'transparent', fontSize: 24, cursor: 'pointer' }}>×</button>
              </div>

              <form onSubmit={handleCreate} style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Startup</label>
                  <select
                    className="field"
                    style={{ width: '100%', marginTop: 4 }}
                    required
                    value={createForm.startup_id}
                    onChange={(e) => {
                      const sid = e.target.value;
                      setCreateForm(prev => ({
                        ...prev,
                        startup_id: sid,
                        round_id: fundingRounds.find(r => String(r.startup_id) === sid)?.round_id ? String(fundingRounds.find(r => String(r.startup_id) === sid).round_id) : prev.round_id
                      }));
                    }}
                  >
                    <option value="">-- Choose Startup --</option>
                    {startups.map(s => (
                      <option key={s.startup_id} value={s.startup_id}>
                        {s.startup_name} ({s.funding_stage || 'Stage'})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Investor</label>
                  <select
                    className="field"
                    style={{ width: '100%', marginTop: 4 }}
                    required
                    value={createForm.investor_id}
                    onChange={(e) => setCreateForm({ ...createForm, investor_id: e.target.value })}
                  >
                    <option value="">-- Choose Investor --</option>
                    {investors.map(i => (
                      <option key={i.investor_id} value={i.investor_id}>
                        {i.firm_name} ({i.investor_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Target Funding Round (OPEN rounds)</label>
                  <select
                    className="field"
                    style={{ width: '100%', marginTop: 4 }}
                    required
                    value={createForm.round_id}
                    onChange={(e) => {
                      const rid = e.target.value;
                      const selectedRound = fundingRounds.find(r => String(r.round_id) === rid);
                      setCreateForm({
                        ...createForm,
                        round_id: rid,
                        amount_offered: selectedRound ? String(selectedRound.amount_required) : createForm.amount_offered
                      });
                    }}
                  >
                    <option value="">-- Choose Funding Round --</option>
                    {fundingRounds.map(r => (
                      <option key={r.round_id} value={r.round_id}>
                        {r.startup_name} - {r.round_name} (Requires ₹{Number(r.amount_required).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="formgrid" style={{ marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Proposed by</label>
                    <select
                      className="field"
                      style={{ width: '100%', marginTop: 4 }}
                      value={createForm.proposed_by}
                      onChange={(e) => setCreateForm({ ...createForm, proposed_by: e.target.value as any })}
                    >
                      <option value="INVESTOR">Investor</option>
                      <option value="STARTUP">Startup Founder</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Equity Percentage (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="100"
                      className="field"
                      style={{ width: '100%', marginTop: 4 }}
                      required
                      value={createForm.equity_percentage}
                      onChange={(e) => setCreateForm({ ...createForm, equity_percentage: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Proposed Amount (INR)</label>
                  <input
                    type="number"
                    min="1"
                    className="field"
                    style={{ width: '100%', marginTop: 4 }}
                    required
                    value={createForm.amount_offered}
                    onChange={(e) => setCreateForm({ ...createForm, amount_offered: e.target.value })}
                  />
                </div>

                {Number(createForm.amount_offered) > 0 && Number(createForm.equity_percentage) > 0 && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                    <span style={{ color: '#166534', fontWeight: 600 }}>Calculated Implied Valuation: </span>
                    <b style={{ color: '#15803d' }}>
                      {formatINR(Number(createForm.amount_offered) / (Number(createForm.equity_percentage) / 100))}
                    </b>
                  </div>
                )}

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Terms & Governance Rights</label>
                  <textarea
                    className="field"
                    style={{ width: '100%', marginTop: 4, height: 65, resize: 'vertical' }}
                    value={createForm.terms}
                    onChange={(e) => setCreateForm({ ...createForm, terms: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Proposal Note (MongoDB Thread)</label>
                  <textarea
                    className="field"
                    style={{ width: '100%', marginTop: 4, height: 50, resize: 'vertical' }}
                    value={createForm.initial_note}
                    onChange={(e) => setCreateForm({ ...createForm, initial_note: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn secondary" onClick={() => setShowCreateModal(false)} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Submit Proposal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Counter-Offer */}
        {showCounterModal && activeItem && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 }}>
            <div className="panel" style={{ width: '100%', maxWidth: 540 }}>
              <div className="sectionhead">
                <div>
                  <h2>Submit Counter-Offer (Round #{Number(activeItem.round_number) + 1})</h2>
                  <p className="muted">
                    {activeItem.startup_name} ↔ {activeItem.firm_name}
                  </p>
                </div>
                <button type="button" onClick={() => setShowCounterModal(false)} style={{ border: 'none', background: 'transparent', fontSize: 24, cursor: 'pointer' }}>×</button>
              </div>

              <form onSubmit={handleCounter} style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Counter-offer submitted by</label>
                  <select
                    className="field"
                    style={{ width: '100%', marginTop: 4 }}
                    value={counterForm.proposed_by}
                    onChange={(e) => setCounterForm({ ...counterForm, proposed_by: e.target.value })}
                  >
                    <option value="STARTUP">Startup Founder ({activeItem.startup_name})</option>
                    <option value="INVESTOR">Investor ({activeItem.firm_name})</option>
                  </select>
                </div>

                <div className="formgrid" style={{ marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Offered Amount (INR)</label>
                    <input
                      type="number"
                      min="1"
                      className="field"
                      style={{ width: '100%', marginTop: 4 }}
                      required
                      value={counterForm.amount_offered}
                      onChange={(e) => setCounterForm({ ...counterForm, amount_offered: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Equity (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="100"
                      className="field"
                      style={{ width: '100%', marginTop: 4 }}
                      required
                      value={counterForm.equity_percentage}
                      onChange={(e) => setCounterForm({ ...counterForm, equity_percentage: e.target.value })}
                    />
                  </div>
                </div>

                {Number(counterForm.amount_offered) > 0 && Number(counterForm.equity_percentage) > 0 && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                    <span style={{ color: '#166534', fontWeight: 600 }}>New Implied Valuation: </span>
                    <b style={{ color: '#15803d' }}>
                      {formatINR(Number(counterForm.amount_offered) / (Number(counterForm.equity_percentage) / 100))}
                    </b>
                  </div>
                )}

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Updated Terms / Rationale</label>
                  <textarea
                    className="field"
                    style={{ width: '100%', marginTop: 4, height: 60, resize: 'vertical' }}
                    value={counterForm.terms}
                    onChange={(e) => setCounterForm({ ...counterForm, terms: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Counter-Offer Note (MongoDB Thread)</label>
                  <textarea
                    className="field"
                    placeholder="Reason for counter-offer..."
                    style={{ width: '100%', marginTop: 4, height: 50, resize: 'vertical' }}
                    value={counterForm.note}
                    onChange={(e) => setCounterForm({ ...counterForm, note: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn secondary" onClick={() => setShowCounterModal(false)} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn" disabled={submitting} style={{ background: '#4338ca' }}>
                    {submitting ? 'Submitting...' : 'Send Counter-Offer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Accept Terms */}
        {showAcceptModal && activeItem && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 }}>
            <div className="panel" style={{ width: '100%', maxWidth: 520 }}>
              <div className="sectionhead">
                <div>
                  <h2 style={{ color: '#15803d' }}>Accept Deal & Finalize Investment</h2>
                  <p className="muted">{activeItem.startup_name} ↔ {activeItem.firm_name}</p>
                </div>
                <button type="button" onClick={() => setShowAcceptModal(false)} style={{ border: 'none', background: 'transparent', fontSize: 24, cursor: 'pointer' }}>×</button>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 14, borderRadius: 10, margin: '14px 0', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="muted">Agreed Investment:</span>
                  <b>{formatINR(activeItem.amount_offered)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="muted">Agreed Equity Stake:</span>
                  <b>{Number(activeItem.equity_percentage).toFixed(1)}%</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="muted">Implied Valuation:</span>
                  <b style={{ color: '#0f766e' }}>{formatINR(activeItem.implied_valuation)}</b>
                </div>
              </div>

              <form onSubmit={handleAccept}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Investment Finalization Date</label>
                  <input
                    type="date"
                    className="field"
                    style={{ width: '100%', marginTop: 4 }}
                    required
                    value={acceptForm.investment_date}
                    onChange={(e) => setAcceptForm({ ...acceptForm, investment_date: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Closing Terms / Notes</label>
                  <textarea
                    className="field"
                    style={{ width: '100%', marginTop: 4, height: 60, resize: 'vertical' }}
                    value={acceptForm.terms}
                    onChange={(e) => setAcceptForm({ ...acceptForm, terms: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Acceptance Note (MongoDB History)</label>
                  <input
                    type="text"
                    className="field"
                    style={{ width: '100%', marginTop: 4 }}
                    value={acceptForm.note}
                    onChange={(e) => setAcceptForm({ ...acceptForm, note: e.target.value })}
                  />
                </div>

                <div className="notice" style={{ fontSize: 12, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                  <b>DBMS Transaction Notice:</b> Accepting this deal executes a MySQL transaction that updates this negotiation to <code>ACCEPTED</code> and automatically records an official row in the <code>investment</code> table.
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                  <button type="button" className="btn secondary" onClick={() => setShowAcceptModal(false)} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn" disabled={submitting} style={{ background: '#16a34a' }}>
                    {submitting ? 'Finalizing...' : 'Confirm & Finalize Deal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Timeline / MongoDB Thread */}
        {showTimelineModal && activeItem && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 }}>
            <div className="panel" style={{ width: '100%', maxWidth: 620, maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="sectionhead">
                <div>
                  <h2>Negotiation History & Timeline</h2>
                  <p className="muted">{activeItem.startup_name} ↔ {activeItem.firm_name} ({activeItem.round_name})</p>
                </div>
                <button type="button" onClick={() => setShowTimelineModal(false)} style={{ border: 'none', background: 'transparent', fontSize: 24, cursor: 'pointer' }}>×</button>
              </div>

              <div style={{ marginTop: 16 }}>
                {timelineLoading ? (
                  <p className="muted" style={{ textAlign: 'center', padding: 20 }}>Loading audit timeline from MongoDB...</p>
                ) : timelineEvents.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {timelineEvents.map((evt, idx) => (
                      <div
                        key={idx}
                        style={{
                          borderLeft: `3px solid ${
                            evt.action === 'ACCEPTED' ? '#16a34a' :
                            evt.action === 'REJECTED' ? '#dc2626' :
                            evt.action === 'COUNTER_OFFERED' ? '#4338ca' : '#d97706'
                          }`,
                          paddingLeft: 14,
                          background: '#f8fafc',
                          padding: 12,
                          borderRadius: '0 8px 8px 0'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: 10,
                                padding: '2px 7px',
                                borderRadius: 10,
                                fontWeight: 700,
                                background: String(evt.author_role).toUpperCase() === 'STARTUP' ? '#e0f2fe' : '#f3e8ff',
                                color: String(evt.author_role).toUpperCase() === 'STARTUP' ? '#0369a1' : '#6b21a8'
                              }}
                            >
                              {String(evt.author_role).toUpperCase() === 'STARTUP' ? 'STARTUP' : 'INVESTOR'}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>
                              {evt.author_name || 'Participant'}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: '#64748b' }}>
                            {new Date(evt.timestamp).toLocaleString()}
                          </span>
                        </div>

                        <div style={{ margin: '6px 0', fontSize: 13, color: '#334155' }}>
                          {evt.note}
                        </div>

                        {evt.amount_offered && (
                          <div style={{ fontSize: 12, color: '#0f766e', fontWeight: 600 }}>
                            Terms: {formatINR(evt.amount_offered)} for {Number(evt.equity_percentage || 0).toFixed(1)}% equity
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="notice" style={{ textAlign: 'center' }}>
                    No custom message events recorded yet. Initial term sheet: <b>{formatINR(activeItem.amount_offered)}</b> for <b>{Number(activeItem.equity_percentage).toFixed(1)}% equity</b>.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn secondary" onClick={() => setShowTimelineModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
