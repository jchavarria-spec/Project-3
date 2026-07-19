import { useEffect, useState } from 'react';
import { api, money, toLocalInput } from '../api.js';

// Create or edit a job. Pass `job` to edit, or `initialDate` (Date) for a new one.
export default function JobModal({ job, initialDate, onClose, onSaved }) {
  const editing = Boolean(job);
  const [services, setServices] = useState([]);
  const [team, setTeam] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newCustomer, setNewCustomer] = useState(!editing);

  const [form, setForm] = useState(() => ({
    customer_id: job?.customer_id || '',
    cust_name: '',
    cust_phone: '',
    cust_email: '',
    service_id: job?.service_id || '',
    technician_id: job?.technician_id || '',
    scheduled_at: toLocalInput(job?.scheduled_at || initialDate || new Date(Date.now() + 3600e3)),
    duration_min: job?.duration_min || 60,
    address: job?.address || '',
    notes: job?.notes || '',
    price: job ? (job.price_cents / 100).toFixed(2) : '',
    status: job?.status || 'confirmed',
  }));

  useEffect(() => {
    api('/services').then(setServices).catch(() => {});
    api('/team').then((t) => setTeam(t.filter((m) => m.active))).catch(() => {});
    api('/customers').then(setCustomers).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickService = (e) => {
    const id = e.target.value;
    const s = services.find((x) => String(x.id) === id);
    setForm((f) => ({
      ...f,
      service_id: id,
      duration_min: s ? s.duration_min : f.duration_min,
      price: s ? (s.price_cents / 100).toFixed(2) : f.price,
    }));
  };

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        service_id: form.service_id || null,
        technician_id: form.technician_id || null,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_min: parseInt(form.duration_min, 10) || 60,
        address: form.address,
        notes: form.notes,
        price_cents: Math.round(parseFloat(form.price || '0') * 100),
        status: form.status,
      };
      if (editing) {
        await api(`/jobs/${job.id}`, { method: 'PATCH', body: payload });
      } else {
        if (newCustomer) {
          if (!form.cust_name) throw new Error('Customer name is required');
          payload.new_customer = {
            name: form.cust_name,
            phone: form.cust_phone,
            email: form.cust_email,
            address: form.address,
          };
        } else {
          if (!form.customer_id) throw new Error('Pick a customer');
          payload.customer_id = form.customer_id;
        }
        await api('/jobs', { method: 'POST', body: payload });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this job? This cannot be undone.')) return;
    try {
      await api(`/jobs/${job.id}`, { method: 'DELETE' });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{editing ? `Job for ${job.customer_name}` : 'New job'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={save}>
          {!editing && (
            <>
              <div className="chip-row" style={{ marginBottom: 12 }}>
                <button type="button" className={`chip ${newCustomer ? 'active' : ''}`} onClick={() => setNewCustomer(true)}>
                  New customer
                </button>
                <button type="button" className={`chip ${!newCustomer ? 'active' : ''}`} onClick={() => setNewCustomer(false)}>
                  Existing customer
                </button>
              </div>
              {newCustomer ? (
                <>
                  <div className="field">
                    <label>Customer name *</label>
                    <input className="input" value={form.cust_name} onChange={set('cust_name')} placeholder="Jane Smith" />
                  </div>
                  <div className="form-row">
                    <div className="field">
                      <label>Phone</label>
                      <input className="input" type="tel" value={form.cust_phone} onChange={set('cust_phone')} placeholder="(555) 123-4567" />
                    </div>
                    <div className="field">
                      <label>Email</label>
                      <input className="input" type="email" value={form.cust_email} onChange={set('cust_email')} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="field">
                  <label>Customer *</label>
                  <select className="input" value={form.customer_id} onChange={set('customer_id')}>
                    <option value="">Select a customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `— ${c.phone}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="field">
            <label>Service</label>
            <select className="input" value={form.service_id || ''} onChange={pickService}>
              <option value="">— No service selected —</option>
              {services.filter((s) => s.active).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({money(s.price_cents)})
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Date & time *</label>
              <input className="input" type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')} required />
            </div>
            <div className="field">
              <label>Duration (minutes)</label>
              <input className="input" type="number" min="15" step="15" value={form.duration_min} onChange={set('duration_min')} />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Assigned technician</label>
              <select className="input" value={form.technician_id || ''} onChange={set('technician_id')}>
                <option value="">Unassigned</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Price ($)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={set('price')} placeholder="0.00" />
            </div>
          </div>

          <div className="field">
            <label>Job address</label>
            <input className="input" value={form.address} onChange={set('address')} placeholder="123 Main St" />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea className="input" value={form.notes} onChange={set('notes')} placeholder="Gate code, dog in yard, symptoms…" />
          </div>
          <div className="field">
            <label>Status</label>
            <select className="input" value={form.status} onChange={set('status')}>
              <option value="pending">Pending (request)</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {form.status === 'completed' && (
              <div className="hint">Marking complete sends the customer a review request automatically.</div>
            )}
          </div>

          <div className="modal-actions">
            {editing && (
              <button type="button" className="btn btn-danger" onClick={remove}>
                Delete
              </button>
            )}
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
