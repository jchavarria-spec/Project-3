import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Team() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const [team, setTeam] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/team').then(setTeam).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/team', { method: 'POST', body: form });
      setAdding(false);
      setForm({ name: '', email: '', phone: '', password: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deactivate(member) {
    if (!window.confirm(`Remove ${member.name} from the team? Their assigned jobs stay on the calendar.`)) return;
    try {
      await api(`/team/${member.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <div className="page-sub">Technicians can sign in with their own account and see their assigned jobs.</div>
        </div>
        {isOwner && <button className="btn" onClick={() => setAdding(true)}>+ Add technician</button>}
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="card">
        {!team ? (
          <div className="empty">Loading…</div>
        ) : (
          team.filter((m) => m.active).map((m) => (
            <div className="job-row" key={m.id} style={{ cursor: 'default' }}>
              <span className="tech-dot" style={{ background: m.color, width: 14, height: 14 }} />
              <div className="job-info">
                <div className="title">{m.name} {m.role === 'owner' && <span className="badge confirmed">Owner</span>}</div>
                <div className="meta">{m.email}{m.phone ? ` · ${m.phone}` : ''}</div>
              </div>
              {isOwner && m.role !== 'owner' && (
                <button className="btn btn-secondary btn-sm" onClick={() => deactivate(m)}>Remove</button>
              )}
            </div>
          ))
        )}
      </div>

      {adding && (
        <div className="modal-backdrop" onClick={() => setAdding(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Add technician</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>✕</button>
            </div>
            {error && <div className="error-box">{error}</div>}
            <form onSubmit={save}>
              <div className="field"><label>Name *</label><input className="input" value={form.name} onChange={set('name')} required autoFocus /></div>
              <div className="form-row">
                <div className="field"><label>Email *</label><input className="input" type="email" value={form.email} onChange={set('email')} required /></div>
                <div className="field"><label>Phone</label><input className="input" type="tel" value={form.phone} onChange={set('phone')} /></div>
              </div>
              <div className="field">
                <label>Temporary password *</label>
                <input className="input" type="text" value={form.password} onChange={set('password')} minLength={8} required />
                <div className="hint">Share this with them — they use it to sign in. At least 8 characters.</div>
              </div>
              <div className="modal-actions">
                <button className="btn" type="submit">Add to team</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
