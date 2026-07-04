import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, money } from '../api.js';
import JobRow from '../components/JobRow.jsx';
import JobModal from '../components/JobModal.jsx';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);

  const load = useCallback(() => {
    api(`/customers/${id}`)
      .then((c) => {
        setCustomer(c);
        setForm({ name: c.name, phone: c.phone, email: c.email, address: c.address, notes: c.notes });
      })
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    try {
      await api(`/customers/${id}`, { method: 'PATCH', body: form });
      setEditing(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${customer.name} and all their job history? This cannot be undone.`)) return;
    await api(`/customers/${id}`, { method: 'DELETE' });
    navigate('/app/customers');
  }

  if (error) return <div className="error-box">{error}</div>;
  if (!customer) return <div className="spinner-page">Loading…</div>;

  const completed = customer.jobs.filter((j) => j.status === 'completed');
  const lifetime = completed.reduce((sum, j) => sum + Number(j.price_cents || 0), 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <Link to="/app/customers" style={{ fontSize: 13 }}>← All customers</Link>
          <h1>{customer.name}</h1>
          <div className="page-sub">
            {customer.phone && <a href={`tel:${customer.phone}`}>{customer.phone}</a>}
            {customer.phone && customer.email && ' · '}
            {customer.email && <a href={`mailto:${customer.email}`}>{customer.email}</a>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn btn-danger" onClick={remove}>Delete</button>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat"><div className="num">{customer.jobs.length}</div><div className="label">Total jobs</div></div>
        <div className="stat"><div className="num">{completed.length}</div><div className="label">Completed</div></div>
        <div className="stat"><div className="num">{money(lifetime)}</div><div className="label">Lifetime value</div></div>
      </div>

      {(customer.address || customer.notes) && (
        <div className="card">
          {customer.address && <p style={{ fontSize: 14 }}><strong>Address:</strong> {customer.address}</p>}
          {customer.notes && <p style={{ fontSize: 14, marginTop: 6, whiteSpace: 'pre-wrap' }}><strong>Notes:</strong> {customer.notes}</p>}
        </div>
      )}

      <div className="card">
        <h2>Job history</h2>
        {customer.jobs.length === 0 ? (
          <div className="empty">No jobs yet for this customer.</div>
        ) : (
          customer.jobs.map((j) => (
            <JobRow key={j.id} job={{ ...j, customer_name: customer.name }} onClick={setSelectedJob} />
          ))
        )}
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Edit customer</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>✕</button>
            </div>
            <form onSubmit={save}>
              <div className="field"><label>Name</label><input className="input" value={form.name} onChange={set('name')} required /></div>
              <div className="form-row">
                <div className="field"><label>Phone</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
                <div className="field"><label>Email</label><input className="input" value={form.email} onChange={set('email')} /></div>
              </div>
              <div className="field"><label>Address</label><input className="input" value={form.address} onChange={set('address')} /></div>
              <div className="field"><label>Notes</label><textarea className="input" value={form.notes} onChange={set('notes')} /></div>
              <div className="modal-actions">
                <button className="btn" type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedJob && (
        <JobModal
          job={{ ...selectedJob, customer_name: customer.name }}
          onClose={() => setSelectedJob(null)}
          onSaved={() => { setSelectedJob(null); load(); }}
        />
      )}
    </div>
  );
}
