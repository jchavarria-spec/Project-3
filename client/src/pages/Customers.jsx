import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, money, fmtDate } from '../api.js';

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState(null);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    api(`/customers${q}`).then(setCustomers).catch(() => setCustomers([]));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const c = await api('/customers', { method: 'POST', body: form });
      navigate(`/app/customers/${c.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Customers</h1>
        <button className="btn" onClick={() => setAdding(true)}>+ Add customer</button>
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Search name, phone, email, address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card table-wrap">
        {!customers ? (
          <div className="empty">Loading…</div>
        ) : customers.length === 0 ? (
          <div className="empty">No customers yet. They’ll appear here automatically when they book online.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Jobs</th>
                <th>Last job</th>
                <th>Lifetime value</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/app/customers/${c.id}`)}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.job_count}</td>
                  <td>{c.last_job_at ? fmtDate(c.last_job_at, { year: 'numeric' }) : '—'}</td>
                  <td>{money(c.lifetime_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adding && (
        <div className="modal-backdrop" onClick={() => setAdding(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Add customer</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>✕</button>
            </div>
            {error && <div className="error-box">{error}</div>}
            <form onSubmit={save}>
              <div className="field">
                <label>Name *</label>
                <input className="input" value={form.name} onChange={set('name')} required autoFocus />
              </div>
              <div className="form-row">
                <div className="field">
                  <label>Phone</label>
                  <input className="input" type="tel" value={form.phone} onChange={set('phone')} />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input className="input" type="email" value={form.email} onChange={set('email')} />
                </div>
              </div>
              <div className="field">
                <label>Address</label>
                <input className="input" value={form.address} onChange={set('address')} />
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea className="input" value={form.notes} onChange={set('notes')} />
              </div>
              <div className="modal-actions">
                <button className="btn" type="submit">Save customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
