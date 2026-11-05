'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';

export default function Preferences() {
  const [v, setV] = useState<any>({});
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/preferences')
      .then(r => r.json())
      .then(d => {
        if (d?.[0]) {
          setV(d[0]);
        }
      })
      .catch(() => {
        setMsg('Could not load preferences.');
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();

    if (saving) return;

    setSaving(true);
    setMsg('');

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
        return;
      }

      setMsg('Investor preferences saved successfully!');

    } catch {
      setMsg('Something went wrong. Please try again.');
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
            <div className="notice" style={{ marginTop: 15 }}>
              {msg}
            </div>
          )}

        </form>

        <div
          className="notice"
          style={{ maxWidth: 680 }}
        >
          To set preferences, first create an Investor profile
          from the Investors page using the same account.
        </div>

      </div>
    </AppShell>
  );
}
