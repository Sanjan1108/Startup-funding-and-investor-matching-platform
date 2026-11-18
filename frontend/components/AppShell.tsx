'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AppShell({
  children,
  userName,
  userRole
}: {
  children: React.ReactNode;
  userName: string;
  userRole?: string;
}) {
  const path = usePathname();
  const [profile, setProfile] = useState<{ name: string; role: string }>({
    name: userName || 'Workspace',
    role: userRole || ''
  });

  useEffect(() => {
    if (!userRole || userName === 'Workspace') {
      fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.user) {
            setProfile({
              name: data.user.name || userName,
              role: data.user.role || userRole || ''
            });
          }
        })
        .catch(() => {});
    }
  }, [userName, userRole]);

  const currentRole = profile.role || userRole || '';
  const displayName = profile.name || userName || 'User';

  // Role-customized navigation links
  let links = [
    ['/dashboard', 'Overview'],
    ['/startups', 'Startups'],
    ['/investors', 'Investors'],
    ['/preferences', 'Investor preferences'],
    ['/matches', 'Investor matches'],
    ['/negotiations', 'Negotiations'],
    ['/funding', 'Funding rounds'],
    ['/investments', 'Investments'],
    ['/meetings', 'Meetings'],
    ['/pitch-decks', 'Pitch decks']
  ];

  if (currentRole === 'STARTUP') {
    links = [
      ['/dashboard', 'Founder Dashboard'],
      ['/startups', 'Startup Profile'],
      ['/matches', 'Matched Investors'],
      ['/negotiations', 'Deal Negotiations'],
      ['/funding', 'Funding Rounds'],
      ['/investments', 'Capital Received'],
      ['/meetings', 'Investor Meetings'],
      ['/pitch-decks', 'Pitch Decks']
    ];
  } else if (currentRole === 'INVESTOR') {
    links = [
      ['/dashboard', 'Portfolio Dashboard'],
      ['/preferences', 'Investment Criteria'],
      ['/matches', 'Startup Deal Flow'],
      ['/negotiations', 'Term Sheet Deals'],
      ['/investments', 'Portfolio Companies'],
      ['/startups', 'Startup Directory'],
      ['/meetings', 'Founder Meetings'],
      ['/pitch-decks', 'Pitch Decks']
    ];
  }

  const roleBadge = currentRole === 'STARTUP' ? 'FOUNDER' : currentRole === 'INVESTOR' ? 'INVESTOR' : 'WORKSPACE';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            venture<span>link.</span>
          </div>
          {currentRole && (
            <div style={{ padding: '0 12px', marginTop: 4 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '1px',
                  padding: '3px 8px',
                  borderRadius: 12,
                  background: currentRole === 'STARTUP' ? '#0284c7' : currentRole === 'INVESTOR' ? '#7c3aed' : '#263b5b',
                  color: '#fff'
                }}
              >
                {roleBadge} PORTAL
              </span>
            </div>
          )}
        </div>

        <div>
          <div className="navlabel">NAVIGATION</div>
          <nav className="nav">
            {links.map(([href, label]) => (
              <Link className={path === href ? 'active' : ''} href={href} key={href}>
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="sidefoot">
          Startup Funding Platform<br />DBMS Level 3 Project
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <b>
              {currentRole === 'STARTUP'
                ? 'Founder Workspace'
                : currentRole === 'INVESTOR'
                ? 'Investor Workspace'
                : 'Workspace'}
            </b>
            <br />
            <small>
              {currentRole === 'STARTUP'
                ? 'Fundraising & deal pipeline management'
                : currentRole === 'INVESTOR'
                ? 'Venture screening & portfolio deal flow'
                : 'Startup funding & investor matching'}
            </small>
          </div>
          <div className="toolbar">
            <span style={{ fontSize: 13, color: '#475569' }}>
              <b>{displayName}</b>{' '}
              {currentRole && (
                <span
                  style={{
                    fontSize: 11,
                    background: '#f1f5f9',
                    padding: '2px 7px',
                    borderRadius: 10,
                    color: '#64748b',
                    fontWeight: 600
                  }}
                >
                  {currentRole}
                </span>
              )}
            </span>
            <button
              className="btn secondary"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                location.href = '/login';
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
