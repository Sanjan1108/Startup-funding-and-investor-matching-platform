'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Register() {
const router = useRouter();

const [v, setV] = useState({
name: '',
email: '',
password: '',
role: 'STARTUP'
});

const [msg, setMsg] = useState('');
const [loading, setLoading] = useState(false);
const [success, setSuccess] = useState(false);

async function submit(e: React.FormEvent) {
e.preventDefault();
setMsg('');
setSuccess(false);
setLoading(true);

try {
  const r = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(v)
  });

  const d = await r.json();

  if (!r.ok) {
    setMsg(d.error || 'Registration failed. Please try again.');
    return;
  }

  setSuccess(true);
  setMsg('Account created successfully! Redirecting to sign in...');

  setTimeout(() => {
    router.push('/login');
  }, 2000);

} catch {
  setMsg('Unable to connect to the server. Please try again.');
} finally {
  setLoading(false);
}

}

return ( <div className="loginpage"> <section className="loginhero"> <div className="brand">venture<span>link.</span></div> <h1>Build meaningful funding connections.</h1> <p>
Create an account to manage a startup or investor profile
and explore the funding network. </p> </section>

  <section className="loginform">
    <form className="loginbox" onSubmit={submit}>
      <div className="eyebrow">GET STARTED</div>
      <h2>Create an account</h2>

      {msg && (
        <div
          className="notice"
          style={{
            color: success ? 'green' : 'red',
            marginBottom: 15
          }}
        >
          {msg}
        </div>
      )}

      <div className="formgroup">
        <label>Full name</label>
        <input
          className="field"
          required
          value={v.name}
          onChange={e => setV({ ...v, name: e.target.value })}
        />
      </div>

      <div className="formgroup" style={{ marginTop: 12 }}>
        <label>Email</label>
        <input
          className="field"
          type="email"
          required
          value={v.email}
          onChange={e => setV({ ...v, email: e.target.value })}
        />
      </div>

      <div className="formgroup" style={{ marginTop: 12 }}>
        <label>Password (minimum 8 characters)</label>
        <input
          className="field"
          type="password"
          minLength={8}
          maxLength={128}
          required
          value={v.password}
          onChange={e => setV({ ...v, password: e.target.value })}
        />
      </div>

      <div className="formgroup" style={{ marginTop: 12 }}>
        <label>Account type</label>
        <select
          className="field"
          value={v.role}
          onChange={e => setV({ ...v, role: e.target.value })}
        >
          <option value="STARTUP">Startup</option>
          <option value="INVESTOR">Investor</option>
        </select>
      </div>

      <button
        className="btn"
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          marginTop: 18,
          opacity: loading ? 0.7 : 1
        }}
      >
        {loading ? 'Creating account...' : 'Create account'}
      </button>

      <p className="muted" style={{ fontSize: 13 }}>
        Already registered?{' '}
        <a href="/login" style={{ color: '#4169e1' }}>
          Sign in
        </a>
      </p>
    </form>
  </section>
</div>


);
}
