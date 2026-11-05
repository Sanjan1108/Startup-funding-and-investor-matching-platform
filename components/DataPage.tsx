'use client';

import { useEffect, useRef, useState } from 'react';
import AppShell from './AppShell';

type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
};

type Column = {
  key: string;
  label: string;
};

// Format monetary values in Indian currency format.
function formatCurrency(value: any) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default function DataPage({
  userName,
  title,
  subtitle,
  type,
  fields,
  columns,
}: {
  userName: string;
  title: string;
  subtitle: string;
  type: string;
  fields: Field[];
  columns: Column[];
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Prevent repeated submissions.
  const savingRef = useRef(false);

  // Load records.
  async function load() {
    setLoading(true);

    try {
      const r = await fetch('/api/data?type=' + type);
      const d = await r.json();

      if (!r.ok) {
        throw new Error(d.error || 'Could not load records.');
      }

      setRows(Array.isArray(d) ? d : []);

    } catch (error) {
      console.error('Loading error:', error);
      setMsg('Could not load records.');

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [type]);

  // Save record.
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setMsg('');

    try {
      const r = await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          ...form,
        }),
      });

      const d = await r.json();

      if (!r.ok) {
        throw new Error(d.error || 'Could not save record.');
      }

      setMsg('Record added successfully!');
      setForm({});
      setShow(false);

      await load();

    } catch (error) {
      console.error('Save error:', error);

      setMsg(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'
      );

    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  // Identify monetary columns.
  const monetaryColumns = [
    'amount_required',
    'amount_invested',
    'min_ticket',
    'max_ticket',
  ];

  return (
    <AppShell userName={userName}>
      <div className="content">

        <div className="eyebrow">
          DATABASE WORKSPACE
        </div>

        <h1 className="title">
          {title}
        </h1>

        <p className="subtitle">
          {subtitle}
        </p>

        {/* Toolbar */}
        <div
          className="toolbar"
          style={{
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <span
            className="muted"
            style={{ fontSize: 13 }}
          >
            {rows.length} records found
          </span>

          <button
            type="button"
            className="btn"
            disabled={saving}
            onClick={() => {
              setShow(!show);
              setMsg('');
            }}
          >
            {show ? 'Close form' : '+ Add new'}
          </button>
        </div>

        {/* Notification */}
        {msg && (
          <div className="notice">
            {msg}
          </div>
        )}

        {/* Add Record Form */}
        {show && (
          <form
            className="panel"
            onSubmit={save}
            style={{ marginBottom: 18 }}
          >
            <div className="formgrid">

              {fields.map((f) => (
                <div
                  className="formgroup"
                  key={f.name}
                >
                  <label>{f.label}</label>

                  {f.options ? (
                    <select
                      className="field"
                      required={f.required}
                      disabled={saving}
                      value={form[f.name] || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [f.name]: e.target.value,
                        })
                      }
                    >
                      <option value="">
                        Select {f.label}
                      </option>

                      {f.options.map((o) => (
                        <option
                          key={o.value}
                          value={o.value}
                        >
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="field"
                      type={f.type || 'text'}
                      required={f.required}
                      disabled={saving}
                      value={form[f.name] || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [f.name]: e.target.value,
                        })
                      }
                    />
                  )}
                </div>
              ))}

            </div>

            <button
              type="submit"
              className="btn"
              disabled={saving}
              style={{
                marginTop: 16,
                opacity: saving ? 0.6 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save record'}
            </button>

          </form>
        )}

        {/* Records Table */}
        <div className="tablewrap">
          <table>

            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="empty"
                  >
                    Loading records...
                  </td>
                </tr>

              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="empty"
                  >
                    No records yet. Add your first record.
                  </td>
                </tr>

              ) : (
                rows.map((r, i) => (
                  <tr key={i}>

                    {columns.map((c) => (
                      <td key={c.key}>

                        {monetaryColumns.includes(c.key) &&
                        r[c.key] !== null &&
                        r[c.key] !== undefined &&
                        r[c.key] !== '' ? (
                          formatCurrency(r[c.key])
                        ) : (
                          r[c.key] ?? '—'
                        )}

                      </td>
                    ))}

                  </tr>
                ))
              )}

            </tbody>
          </table>
        </div>

      </div>
    </AppShell>
  );
}