import { redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import AppShell from '@/components/AppShell';
import { currentUser } from '@/lib/auth';

function formatINR(val: any) {
  const num = Number(val);
  if (!Number.isFinite(num)) return '₹0';
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(1)} L`;
  }
  return `₹${num.toLocaleString('en-IN')}`;
}

function scoreColor(score: number) {
  if (score >= 80) return '#16a34a';
  if (score >= 65) return '#2563eb';
  if (score >= 50) return '#d97706';
  return '#dc2626';
}

function statusPill(status: string) {
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

export default async function Dashboard({
  searchParams
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const u = await currentUser();
  if (!u) redirect('/login');

  const resolvedParams = await searchParams;
  const requestedView = resolvedParams?.view || '';

  // Strictly enforce role-based access:
  // - STARTUP accounts can only access the startup dashboard
  // - INVESTOR accounts can only access the investor dashboard
  // - ADMIN accounts can access requested views
  const allowedView = u.role === 'STARTUP'
    ? 'startup'
    : u.role === 'INVESTOR'
    ? 'investor'
    : (requestedView || 'platform');

  const cookieStore = await cookies();
  const token = cookieStore.get('sf_session')?.value;

  const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

  let data: any = {
    activeView: allowedView,
    startupProfile: null,
    startupMetrics: { raised: 0, target: 0, matches: 0, negotiations: 0, meetings: 0 },
    startupNegotiations: [],
    startupRounds: [],
    startupMatches: [],
    startupInvestments: [],
    investorProfile: null,
    investorMetrics: { deployed: 0, portfolioCount: 0, pipeline: 0, negotiations: 0, meetings: 0 },
    investorNegotiations: [],
    investorPortfolio: [],
    investorDealFlow: [],
    platformStats: { startups: 0, investors: 0, matches: 0, negotiations: 0, invested: 0 }
  };

  try {
    const res = await fetch(`${backendUrl}/api/dashboard?view=${allowedView}`, {
      headers: {
        cookie: `sf_session=${token || ''}`
      },
      cache: 'no-store'
    });

    if (res.ok) {
      data = await res.json();
    }
  } catch (err) {
    console.error('Failed to load dashboard data from backend:', err);
  }

  const activeView = data.activeView;
  const startupProfile = data.startupProfile;
  const startupMetrics = data.startupMetrics || {};
  const startupNegotiations: Record<string, any>[] = data.startupNegotiations || [];
  const startupRounds: Record<string, any>[] = data.startupRounds || [];
  const startupMatches: Record<string, any>[] = data.startupMatches || [];
  const startupInvestments: Record<string, any>[] = data.startupInvestments || [];
  const investorProfile = data.investorProfile;
  const investorMetrics = data.investorMetrics || {};
  const investorNegotiations: Record<string, any>[] = data.investorNegotiations || [];
  const investorPortfolio: Record<string, any>[] = data.investorPortfolio || [];
  const investorDealFlow: Record<string, any>[] = data.investorDealFlow || [];
  const platformStats = data.platformStats || {};

  return (
    <AppShell userName={u.name} userRole={u.role}>
      <div className="content">

        {/* Top View Selector Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="eyebrow" style={{ letterSpacing: '1.2px' }}>
            {activeView === 'startup'
              ? 'FOUNDER DASHBOARD'
              : activeView === 'investor'
              ? 'INVESTOR PORTFOLIO DASHBOARD'
              : 'ECOSYSTEM OVERVIEW'}
          </div>

          {/* Perspective Switcher: Only accessible to administrators */}
          {u.role === 'ADMIN' && (
            <div style={{ display: 'flex', gap: 6, background: '#e2e8f0', padding: 4, borderRadius: 10 }}>
              <Link
                href="/dashboard?view=startup"
                style={{
                  padding: '6px 13px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: activeView === 'startup' ? '#ffffff' : 'transparent',
                  color: activeView === 'startup' ? '#0369a1' : '#64748b',
                  boxShadow: activeView === 'startup' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                🏢 Founder View
              </Link>
              <Link
                href="/dashboard?view=investor"
                style={{
                  padding: '6px 13px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: activeView === 'investor' ? '#ffffff' : 'transparent',
                  color: activeView === 'investor' ? '#6b21a8' : '#64748b',
                  boxShadow: activeView === 'investor' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                💼 Investor View
              </Link>
              <Link
                href="/dashboard?view=platform"
                style={{
                  padding: '6px 13px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: activeView === 'platform' ? '#ffffff' : 'transparent',
                  color: activeView === 'platform' ? '#0f172a' : '#64748b',
                  boxShadow: activeView === 'platform' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                🌐 Platform Overview
              </Link>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 1. STARTUP / FOUNDER DASHBOARD VIEW                      */}
        {/* ======================================================== */}
        {activeView === 'startup' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 className="title">
                {startupProfile ? startupProfile.startup_name : `Welcome, ${u.name.split(' ')[0]}`}
              </h1>
              <p className="subtitle" style={{ margin: '4px 0 0' }}>
                Track your venture fundraising pipeline, active term sheets, and investor relationships.
              </p>
            </div>

            {/* Startup Profile Banner */}
            {startupProfile ? (
              <div
                style={{
                  background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                  color: '#fff',
                  borderRadius: 14,
                  padding: '20px 24px',
                  marginBottom: 24,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ margin: 0, font: '800 22px Manrope', color: '#fff' }}>
                      {startupProfile.startup_name}
                    </h2>
                    <span style={{ fontSize: 11, background: '#38bdf820', color: '#38bdf8', border: '1px solid #38bdf840', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                      {startupProfile.funding_stage || 'SEED'}
                    </span>
                    <span style={{ fontSize: 11, background: '#ffffff15', color: '#e2e8f0', padding: '2px 8px', borderRadius: 20 }}>
                      {startupProfile.industry_name}
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8', maxWidth: 600 }}>
                    {startupProfile.description || 'No description provided.'}
                  </p>
                  <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 12, color: '#cbd5e1' }}>
                    <span>📍 {startupProfile.location || 'India'}</span>
                    {startupProfile.website && (
                      <a href={startupProfile.website} target="_blank" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
                        🌐 {startupProfile.website.replace('https://', '')}
                      </a>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <Link href="/funding" className="btn" style={{ background: '#0284c7', color: '#fff' }}>
                    + New Round
                  </Link>
                  <Link href="/startups" className="btn secondary" style={{ background: '#ffffff15', color: '#fff', border: '1px solid #ffffff30' }}>
                    Edit Profile
                  </Link>
                </div>
              </div>
            ) : (
              <div className="notice" style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', padding: 18, borderRadius: 12, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <b>Startup Profile Incomplete</b>
                    <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                      You haven&apos;t linked a startup profile to your founder account yet. Register your startup to unlock matching algorithms and deal negotiations.
                    </p>
                  </div>
                  <Link href="/startups" className="btn" style={{ background: '#0284c7' }}>
                    Create Startup Profile
                  </Link>
                </div>
              </div>
            )}

            {/* Founder Metric Cards */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 28 }}>
              <div className="card">
                <div className="metriclabel">Capital Raised</div>
                <div className="metric" style={{ color: '#16a34a' }}>{formatINR(startupMetrics.raised)}</div>
                <div className="metriclabel">Total investments closed</div>
              </div>
              <div className="card">
                <div className="metriclabel">Funding Goal Seeking</div>
                <div className="metric" style={{ color: '#0284c7' }}>{formatINR(startupMetrics.target)}</div>
                <div className="metriclabel">Active OPEN funding rounds</div>
              </div>
              <div className="card">
                <div className="metriclabel">Matched Investors</div>
                <div className="metric">{startupMetrics.matches}</div>
                <div className="metriclabel">Algorithm-recommended investors</div>
              </div>
              <div className="card">
                <div className="metriclabel">Active Negotiations</div>
                <div className="metric" style={{ color: '#4338ca' }}>{startupMetrics.negotiations}</div>
                <div className="metriclabel">Live term sheets & counter-offers</div>
              </div>
              <div className="card">
                <div className="metriclabel">Pitch Meetings</div>
                <div className="metric">{startupMetrics.meetings}</div>
                <div className="metriclabel">Investor discussions logged</div>
              </div>
            </div>

            {/* Founder Deal Negotiations Section */}
            <div className="section">
              <div className="sectionhead">
                <div>
                  <h2>Active Term Sheets & Negotiations</h2>
                  <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>
                    Live valuation and equity discussions with interested investors.
                  </p>
                </div>
                <Link href="/negotiations" className="btn secondary" style={{ fontSize: 12 }}>
                  Open Negotiations Room →
                </Link>
              </div>

              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Investor Firm</th>
                      <th>Funding Round</th>
                      <th>Offered Capital</th>
                      <th>Equity Requested</th>
                      <th>Implied Valuation</th>
                      <th>Status & Turn</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {startupNegotiations.length ? (
                      startupNegotiations.map((n) => (
                        <tr key={n.negotiation_id}>
                          <td><b>{n.firm_name}</b></td>
                          <td>{n.round_name}</td>
                          <td><b style={{ color: '#1e293b' }}>{formatINR(n.amount_offered)}</b></td>
                          <td><span style={{ color: '#4338ca', fontWeight: 600 }}>{Number(n.equity_percentage).toFixed(1)}%</span></td>
                          <td>
                            {n.equity_percentage > 0
                              ? formatINR(Number(n.amount_offered) / (Number(n.equity_percentage) / 100))
                              : '—'}
                          </td>
                          <td>
                            {statusPill(n.status)}
                            <br />
                            <small style={{ fontSize: 11, color: '#64748b' }}>
                              {n.proposed_by === 'STARTUP' ? '⏳ Awaiting Investor' : '⚡ Your Turn to Respond'}
                            </small>
                          </td>
                          <td>
                            <Link
                              href="/negotiations"
                              style={{
                                background: '#4338ca',
                                color: '#fff',
                                padding: '5px 10px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600
                              }}
                            >
                              View / Counter
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="empty">
                          No active negotiations currently. Initiate a proposal from your matched investors.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Open Rounds & Top Matched Investors (2-column grid) */}
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 28 }}>
              {/* Funding Rounds */}
              <div className="panel">
                <div className="sectionhead">
                  <h2>Funding Rounds</h2>
                  <Link href="/funding" style={{ fontSize: 12, color: '#4169e1', fontWeight: 600 }}>
                    Manage Rounds →
                  </Link>
                </div>
                {startupRounds.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {startupRounds.map((fr) => {
                      const required = Number(fr.amount_required);
                      const funded = Number(fr.funded_amount || 0);
                      const pct = Math.min(100, Math.round((funded / (required || 1)) * 100));
                      return (
                        <div key={fr.round_id} style={{ border: '1px solid #eef2f6', borderRadius: 10, padding: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <b>{fr.round_name}</b>
                            <span className="pill">{fr.status}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginTop: 8 }}>
                            <span>Raised: {formatINR(funded)}</span>
                            <span>Target: {formatINR(required)}</span>
                          </div>
                          <div style={{ height: 6, background: '#e2e8f0', borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#16a34a', borderRadius: 4 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: 13 }}>No funding rounds created yet.</p>
                )}
              </div>

              {/* Top Investor Matches */}
              <div className="panel">
                <div className="sectionhead">
                  <h2>Top Matched Investors</h2>
                  <Link href="/matches" style={{ fontSize: 12, color: '#4169e1', fontWeight: 600 }}>
                    View All Matches →
                  </Link>
                </div>
                {startupMatches.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {startupMatches.map((m) => (
                      <div key={m.match_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                        <div>
                          <b>{m.firm_name}</b>
                          <br />
                          <small className="muted">{m.investor_type} · {m.location}</small>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <b style={{ color: scoreColor(Number(m.match_score)), fontSize: 15 }}>
                            {Number(m.match_score).toFixed(0)}%
                          </b>
                          <br />
                          <Link href="/matches" style={{ fontSize: 11, color: '#4169e1', fontWeight: 600 }}>
                            Negotiate →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: 13 }}>No investor matches found yet.</p>
                )}
              </div>
            </div>

            {/* Recent Investments Received */}
            {startupInvestments.length > 0 && (
              <div className="section" style={{ marginTop: 28 }}>
                <div className="sectionhead">
                  <h2>Official Investments Received</h2>
                  <Link href="/investments" className="muted" style={{ fontSize: 12 }}>
                    View All Investments →
                  </Link>
                </div>
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Investor</th>
                        <th>Round</th>
                        <th>Amount Invested</th>
                        <th>Equity %</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {startupInvestments.map((inv) => (
                        <tr key={inv.investment_id}>
                          <td><b>{inv.firm_name}</b></td>
                          <td>{inv.round_name}</td>
                          <td><b style={{ color: '#16a34a' }}>{formatINR(inv.amount_invested)}</b></td>
                          <td>{inv.equity_percentage ? `${Number(inv.equity_percentage).toFixed(1)}%` : '—'}</td>
                          <td>{String(inv.investment_date).slice(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. INVESTOR PORTFOLIO DASHBOARD VIEW                     */}
        {/* ======================================================== */}
        {activeView === 'investor' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 className="title">
                {investorProfile ? investorProfile.firm_name : `Welcome, ${u.name.split(' ')[0]}`}
              </h1>
              <p className="subtitle" style={{ margin: '4px 0 0' }}>
                Track your venture capital portfolio, deal screening pipeline, and active term sheet negotiations.
              </p>
            </div>

            {/* Investor Profile & Mandate Banner */}
            {investorProfile ? (
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                  color: '#fff',
                  borderRadius: 14,
                  padding: '20px 24px',
                  marginBottom: 24,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ margin: 0, font: '800 22px Manrope', color: '#fff' }}>
                      {investorProfile.firm_name}
                    </h2>
                    <span style={{ fontSize: 11, background: '#a855f730', color: '#c084fc', border: '1px solid #c084fc40', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                      {investorProfile.investor_type || 'Venture Capital'}
                    </span>
                    <span style={{ fontSize: 11, background: '#ffffff15', color: '#e2e8f0', padding: '2px 8px', borderRadius: 20 }}>
                      📍 {investorProfile.location || 'India'}
                    </span>
                  </div>

                  {/* Criteria Mandate */}
                  <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 13, color: '#cbd5e1', flexWrap: 'wrap' }}>
                    <span>
                      🎯 <b>Target Industry:</b> {investorProfile.preferred_industry || 'All Industries'}
                    </span>
                    <span>
                      🌱 <b>Preferred Stage:</b> {investorProfile.preferred_stage || 'Any Stage'}
                    </span>
                    <span>
                      💰 <b>Ticket Size:</b> {investorProfile.min_ticket ? formatINR(investorProfile.min_ticket) : '₹0'} – {investorProfile.max_ticket ? formatINR(investorProfile.max_ticket) : 'No Cap'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <Link href="/matches" className="btn" style={{ background: '#6366f1', color: '#fff' }}>
                    Screen Deal Flow
                  </Link>
                  <Link href="/preferences" className="btn secondary" style={{ background: '#ffffff15', color: '#fff', border: '1px solid #ffffff30' }}>
                    Update Criteria
                  </Link>
                </div>
              </div>
            ) : (
              <div className="notice" style={{ background: '#f5f3ff', color: '#6b21a8', border: '1px solid #ddd6fe', padding: 18, borderRadius: 12, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <b>Investor Profile Incomplete</b>
                    <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                      Complete your investor profile and preferences to calibrate the weighted matching algorithm to your target sector and ticket size.
                    </p>
                  </div>
                  <Link href="/investors" className="btn" style={{ background: '#7c3aed' }}>
                    Create Investor Profile
                  </Link>
                </div>
              </div>
            )}

            {/* Investor Metric Cards */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 28 }}>
              <div className="card">
                <div className="metriclabel">Capital Deployed</div>
                <div className="metric" style={{ color: '#16a34a' }}>{formatINR(investorMetrics.deployed)}</div>
                <div className="metriclabel">Total portfolio investments</div>
              </div>
              <div className="card">
                <div className="metriclabel">Portfolio Companies</div>
                <div className="metric" style={{ color: '#4338ca' }}>{investorMetrics.portfolioCount}</div>
                <div className="metriclabel">Active startup holdings</div>
              </div>
              <div className="card">
                <div className="metriclabel">Deal Flow Pipeline</div>
                <div className="metric">{investorMetrics.pipeline}</div>
                <div className="metriclabel">Algorithm-ranked matches</div>
              </div>
              <div className="card">
                <div className="metriclabel">Active Term Sheets</div>
                <div className="metric" style={{ color: '#7c3aed' }}>{investorMetrics.negotiations}</div>
                <div className="metriclabel">Pending deal negotiations</div>
              </div>
              <div className="card">
                <div className="metriclabel">Founder Pitches</div>
                <div className="metric">{investorMetrics.meetings}</div>
                <div className="metriclabel">Meetings recorded</div>
              </div>
            </div>

            {/* Investor Deal Negotiations Section */}
            <div className="section">
              <div className="sectionhead">
                <div>
                  <h2>Active Term Sheet Negotiations</h2>
                  <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>
                    Pending valuations, counter-offers, and investment terms with startups.
                  </p>
                </div>
                <Link href="/negotiations" className="btn secondary" style={{ fontSize: 12 }}>
                  Open Negotiation Hub →
                </Link>
              </div>

              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Startup</th>
                      <th>Funding Round</th>
                      <th>Proposed Investment</th>
                      <th>Equity %</th>
                      <th>Implied Valuation</th>
                      <th>Round & Turn</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investorNegotiations.length ? (
                      investorNegotiations.map((n) => (
                        <tr key={n.negotiation_id}>
                          <td>
                            <b>{n.startup_name}</b>
                            <span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, marginLeft: 6 }}>
                              {n.funding_stage || 'Stage'}
                            </span>
                          </td>
                          <td>{n.round_name}</td>
                          <td><b style={{ color: '#1e293b' }}>{formatINR(n.amount_offered)}</b></td>
                          <td><span style={{ color: '#4338ca', fontWeight: 600 }}>{Number(n.equity_percentage).toFixed(1)}%</span></td>
                          <td>
                            {n.equity_percentage > 0
                              ? formatINR(Number(n.amount_offered) / (Number(n.equity_percentage) / 100))
                              : '—'}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>Round #{n.round_number}</span>
                            <br />
                            <small style={{ fontSize: 11, color: '#64748b' }}>
                              {n.proposed_by === 'INVESTOR' ? '⏳ Awaiting Startup' : '⚡ Your Turn to Counter'}
                            </small>
                          </td>
                          <td>{statusPill(n.status)}</td>
                          <td>
                            <Link
                              href="/negotiations"
                              style={{
                                background: '#4338ca',
                                color: '#fff',
                                padding: '5px 10px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600
                              }}
                            >
                              Counter / Accept
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="empty">
                          No active deal negotiations. Browse startup deal flow to initiate term sheets.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Portfolio Holdings & Deal Flow Grid */}
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 28 }}>
              {/* Portfolio Companies */}
              <div className="panel">
                <div className="sectionhead">
                  <h2>Portfolio Investments</h2>
                  <Link href="/investments" style={{ fontSize: 12, color: '#4169e1', fontWeight: 600 }}>
                    All Investments →
                  </Link>
                </div>
                {investorPortfolio.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {investorPortfolio.map((inv) => (
                      <div key={inv.investment_id} style={{ border: '1px solid #eef2f6', borderRadius: 10, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <b>{inv.startup_name}</b>
                          <b style={{ color: '#16a34a' }}>{formatINR(inv.amount_invested)}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginTop: 6 }}>
                          <span>{inv.round_name} · {inv.industry_name}</span>
                          <span>{inv.equity_percentage ? `${Number(inv.equity_percentage).toFixed(1)}% Equity` : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: 13 }}>No investments recorded yet.</p>
                )}
              </div>

              {/* High-Compatibility Deal Flow Opportunities */}
              <div className="panel">
                <div className="sectionhead">
                  <h2>High-Fit Deal Opportunities</h2>
                  <Link href="/matches" style={{ fontSize: 12, color: '#4169e1', fontWeight: 600 }}>
                    Run Matching Engine →
                  </Link>
                </div>
                {investorDealFlow.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {investorDealFlow.map((d) => (
                      <div key={d.match_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                        <div>
                          <b>{d.startup_name}</b>
                          <span style={{ fontSize: 11, background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>
                            {d.funding_stage}
                          </span>
                          <br />
                          <small className="muted">{d.industry_name} · Seeking {formatINR(d.seeking_amount)}</small>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <b style={{ color: scoreColor(Number(d.match_score)), fontSize: 15 }}>
                            {Number(d.match_score).toFixed(0)}% Fit
                          </b>
                          <br />
                          <Link href="/matches" style={{ fontSize: 11, color: '#4169e1', fontWeight: 600 }}>
                            Negotiate Term Sheet →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: 13 }}>No startup matches available.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. PLATFORM ECOSYSTEM OVERVIEW VIEW                      */}
        {/* ======================================================== */}
        {activeView === 'platform' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 className="title">Good to see you, {u.name.split(' ')[0]}.</h1>
              <p className="subtitle" style={{ margin: '4px 0 0' }}>
                Macro ecosystem intelligence across the entire startup funding and matching platform.
              </p>
            </div>

            {/* Platform Metrics */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', marginBottom: 28 }}>
              <div className="card">
                <div className="metriclabel">Registered Startups</div>
                <div className="metric">{platformStats.startups}</div>
                <div className="metriclabel">Active startup profiles</div>
              </div>
              <div className="card">
                <div className="metriclabel">Investors & VCs</div>
                <div className="metric">{platformStats.investors}</div>
                <div className="metriclabel">Active investor mandates</div>
              </div>
              <div className="card">
                <div className="metriclabel">Potential Matches</div>
                <div className="metric">{platformStats.matches}</div>
                <div className="metriclabel">Calculated algorithmic fits</div>
              </div>
              <div className="card">
                <div className="metriclabel">Active Negotiations</div>
                <div className="metric" style={{ color: '#4338ca' }}>{platformStats.negotiations}</div>
                <div className="metriclabel">Ongoing term sheet rounds</div>
              </div>
              <div className="card">
                <div className="metriclabel">Capital Invested</div>
                <div className="metric" style={{ color: '#16a34a' }}>{formatINR(platformStats.invested)}</div>
                <div className="metriclabel">Total committed funding</div>
              </div>
            </div>

            {/* Explore workspace links */}
            <div className="section">
              <div className="sectionhead">
                <h2>Explore Platform Modules</h2>
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}>
                {[
                  ['Startups', 'Manage startup directory and funding stage profiles.', '/startups'],
                  ['Investors', 'Explore institutional and angel investor criteria.', '/investors'],
                  ['Investor Matches', 'Run weighted matching engine to score fit.', '/matches'],
                  ['Deal Negotiations', 'Multi-round term sheets, counter-offers and valuations.', '/negotiations'],
                  ['Funding Rounds', 'Track open funding targets, caps, and progress.', '/funding'],
                  ['Investments', 'Relational investment records and equity stakes.', '/investments'],
                  ['Meetings', 'Schedule investor pitches and outcome notes.', '/meetings'],
                  ['Pitch Decks', 'Store MySQL references and MongoDB searchable text.', '/pitch-decks']
                ].map(([t, d, h]) => (
                  <Link href={h} className="card" key={t}>
                    <b>{t} ↗</b>
                    <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>
                      {d}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="notice" style={{ marginTop: 24 }}>
              <b>DBMS Architecture Note:</b> VentureLink employs a dual-paradigm architecture: MySQL manages structured relational models with foreign keys, checks, ACID transaction deal acceptance, and triggers; MongoDB powers flexible pitch text search and negotiation history timeline threads.
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
