import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
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
        <h1>Welcome back</h1>
        <p className="sub">Sign in to your dashboard.</p>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-block btn-lg" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 14, textAlign: 'center' }}>
          New here? <Link to="/register">Create your account</Link>
        </p>
      </div>
    </div>
  );
}
