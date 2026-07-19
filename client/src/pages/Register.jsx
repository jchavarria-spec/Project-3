import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const trades = [
  { value: 'plumbing', label: '🚿 Plumbing' },
  { value: 'hvac', label: '❄️ HVAC' },
  { value: 'electrical', label: '⚡ Electrical' },
  { value: 'cleaning', label: '🧹 Cleaning' },
  { value: 'other', label: '🔧 Other' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    businessName: '',
    trade: 'plumbing',
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/app');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link to="/" className="auth-brand" style={{ color: 'var(--text)' }}>🔧 FieldBook</Link>
        <h1>Set up your business</h1>
        <p className="sub">Takes about 2 minutes. We’ll even pre-load services for your trade.</p>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Business name</label>
            <input className="input" value={form.businessName} onChange={set('businessName')} placeholder="Smith Plumbing Co." required autoFocus />
          </div>
          <div className="field">
            <label>What do you do?</label>
            <select className="input" value={form.trade} onChange={set('trade')}>
              {trades.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Your name</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="Mike Smith" required />
          </div>
          <div className="form-row">
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} required />
            </div>
            <div className="field">
              <label>Business phone</label>
              <input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="(555) 123-4567" />
            </div>
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" value={form.password} onChange={set('password')} minLength={8} required />
            <div className="hint">At least 8 characters.</div>
          </div>
          <button className="btn btn-block btn-lg" disabled={busy}>
            {busy ? 'Creating your account…' : 'Create my account'}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 14, textAlign: 'center' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
