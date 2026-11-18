'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

export default function Preferences() {
  const [v, setV] = useState<any>({});
  const [msg, setMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(userData => {
        if (userData?.user?.role === 'STARTUP') {
          setDenied(true);
          setMsg('Access Restricted: Only investor accounts can configure investment preferences.');
          return;
        }

        fetch('/api/preferences')
          .then(r => {
            if (r.status === 403) {
              setDenied(true);
              return null;
            }
            return r.json();
          })
          .then(d => {
            if (d?.[0]) {
              setV(d[0]);
            }
          })
          .catch(() => {
            setMsg('Could not load preferences.');
          });
      })
      .catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();

    if (saving) return;

    setSaving(true);
    setMsg('');
    setIsSuccess(false);

    try {
      const r = await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(v),
      });

      const d = await r.json();

      if (!r.ok) {
        setMsg(d.error || 'Could not save preferences.');
        setIsSuccess(false);
        return;
      }

      setIsSuccess(true);
      setMsg('Investor preferences saved successfully! You can now run matching to view startups that fit your criteria.');

    } catch {
      setMsg('Something went wrong. Please try again.');
      setIsSuccess(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell userName="Workspace">
      <div className="content">

        <div className="eyebrow">
          MATCHING SETTINGS
        </div>

        <h1 className="title">
          Investor preferences
        </h1>

        <p className="subtitle">
          Investors can define the sectors, stages and ticket sizes
          they prefer. The matching engine uses these fields to
          calculate fit.
        </p>

        {denied ? (
          <div className="notice error" style={{ maxWidth: 680, padding: 20, marginTop: 20 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Access Restricted</h3>
            <p style={{ margin: 0, fontSize: 14 }}>
              Investment Preferences are only accessible to registered Investors and Platform Administrators. As a startup founder, your profile and funding rounds are automatically scored against investor criteria.
            </p>
            <div style={{ marginTop: 16 }}>
              <Link href="/dashboard" className="btn" style={{ textDecoration: 'none' }}>
                Go to Founder Dashboard
              </Link>
            </div>
          </div>
        ) : (
        <form
          className="panel"
          onSubmit={save}
          style={{ maxWidth: 680 }}
        >

          <div className="formgrid">

            {/* Industry Dropdown */}
            <div className="formgroup">
              <label>Preferred Industry (optional)</label>

              <select
                className="field"
                value={v.industry_id ?? ''}
                onChange={e =>
                  setV({
                    ...v,
                    industry_id: e.target.value,
                  })
                }
                disabled={saving}
              >
                <option value="">Any industry</option>

                <option value="1">FinTech</option>
                <option value="2">HealthTech</option>
                <option value="3">EdTech</option>
                <option value="4">AgriTech</option>
                <option value="5">E-Commerce</option>
                <option value="6">Artificial Intelligence</option>
                <option value="7">CleanTech</option>
                <option value="8">Cybersecurity</option>
              </select>
            </div>

            {/* Funding Stage Dropdown */}
            <div className="formgroup">
              <label>Preferred funding stage</label>

              <select
                className="field"
                value={v.preferred_stage || ''}
                onChange={e =>
                  setV({
                    ...v,
                    preferred_stage: e.target.value,
                  })
                }
                disabled={saving}
              >
                <option value="">Any stage</option>

                <option value="PRE_SEED">Pre-Seed</option>
                <option value="SEED">Seed</option>
                <option value="SERIES_A">Series A</option>
                <option value="SERIES_B">Series B</option>
                <option value="SERIES_C">Series C</option>
              </select>
            </div>

            {/* Minimum Investment */}
            <div className="formgroup">
              <label>Minimum ticket (INR)</label>

              <input
                className="field"
                type="number"
                min="0"
                value={v.min_ticket ?? ''}
                onChange={e =>
                  setV({
                    ...v,
                    min_ticket: e.target.value,
                  })
                }
                disabled={saving}
              />
            </div>

            {/* Maximum Investment */}
            <div className="formgroup">
              <label>Maximum ticket (INR)</label>

              <input
                className="field"
                type="number"
                min="0"
                value={v.max_ticket ?? ''}
                onChange={e =>
                  setV({
                    ...v,
                    max_ticket: e.target.value,
                  })
                }
                disabled={saving}
              />
            </div>

          </div>

          <button
            className="btn"
            type="submit"
            disabled={saving}
            style={{
              marginTop: 18,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save preferences'}
          </button>

          {msg && (
            <div
              className="notice"
              style={{
                marginTop: 15,
                background: isSuccess ? '#f0fdf4' : '#fef2f2',
                border: isSuccess ? '1px solid #bbf7d0' : '1px solid #fecaca',
                color: isSuccess ? '#166534' : '#991b1b',
                borderRadius: 8,
                padding: '12px 16px'
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: isSuccess ? 8 : 0 }}>
                {isSuccess ? '✅ ' : '❌ '}{msg}
              </div>
              {isSuccess && (
                <div style={{ marginTop: 8 }}>
                  <Link
                    href="/matches"
                    className="btn"
                    style={{
                      background: '#16a34a',
                      color: '#fff',
                      textDecoration: 'none',
                      fontSize: 13,
                      padding: '8px 14px',
                      display: 'inline-block',
                      borderRadius: 6,
                      fontWeight: 600
                    }}
                  >
                    Go to Investor Matches & Run Matching →
                  </Link>
                </div>
              )}
            </div>
          )}

        </form>
        )}

        <div
          className="notice"
          style={{ maxWidth: 680 }}
        >
          💡 <b>How It Works:</b> Setting industry focus, funding stage, and ticket size range calibrates the weighted matching engine. Once saved, head over to <b>Investor matches</b> and select <b>Run matching</b> to view high-compatibility startup deals.
        </div>

      </div>
    </AppShell>
  );
}
