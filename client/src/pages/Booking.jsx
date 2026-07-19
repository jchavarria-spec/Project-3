import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, money } from '../api.js';

export default function Booking() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [serviceId, setServiceId] = useState(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState(null);
  const [time, setTime] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    api(`/public/${slug}`, { auth: false })
      .then(setData)
      .catch(() => setNotFound(true));
  }, [slug]);

  // Next 14 days as choices
  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const pad = (n) => String(n).padStart(2, '0');
      out.push({
        key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      });
    }
    return out;
  }, []);

  useEffect(() => {
    if (!date) return;
    setSlots(null);
    setTime('');
    const params = new URLSearchParams({ date });
    if (serviceId) params.set('service_id', serviceId);
    api(`/public/${slug}/slots?${params}`, { auth: false })
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]));
  }, [slug, date, serviceId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!date || !time) {
      setError('Please pick a date and time.');
      return;
    }
    setBusy(true);
    try {
      const res = await api(`/public/${slug}/book`, {
        method: 'POST',
        auth: false,
        body: { service_id: serviceId, date, time, ...form },
      });
      setDone(res.message);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const fmtSlot = (t) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 || 12;
    return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  if (notFound) {
    return (
      <div className="booking-wrap">
        <div className="card empty">This booking page doesn’t exist. Double-check the link.</div>
      </div>
    );
  }
  if (!data) return <div className="spinner-page">Loading…</div>;

  const { business, services } = data;

  if (done) {
    return (
      <div className="booking-wrap">
        <div className="booking-header">
          {business.logo_url && <img src={business.logo_url} alt={business.name} />}
          <h1>{business.name}</h1>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 44 }}>✅</div>
          <h2 style={{ margin: '10px 0 6px' }}>Request sent!</h2>
          <p style={{ color: 'var(--muted)' }}>{done}</p>
          {business.phone && (
            <p style={{ marginTop: 14, fontSize: 14 }}>
              Need it sooner? Call <a href={`tel:${business.phone}`}>{business.phone}</a>.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="booking-wrap">
      <div className="booking-header">
        {business.logo_url && <img src={business.logo_url} alt={business.name} />}
        <h1>{business.name}</h1>
        <p>{business.booking_intro}</p>
      </div>

      <form onSubmit={submit}>
        {services.length > 0 && (
          <>
            <div className="step-label">1 · Choose a service</div>
            {services.map((s) => (
              <button
                type="button"
                key={s.id}
                className={`service-option ${serviceId === s.id ? 'selected' : ''}`}
                onClick={() => setServiceId(s.id)}
              >
                <span>
                  <span className="name">{s.name}</span>
                  {s.description && <div className="desc">{s.description}</div>}
                  <div className="desc">{s.duration_min} min</div>
                </span>
                <span className="price">{s.price_cents > 0 ? money(s.price_cents) : 'Quote'}</span>
              </button>
            ))}
          </>
        )}

        <div className="step-label">{services.length > 0 ? '2' : '1'} · Pick a day</div>
        <div className="slot-grid">
          {days.map((d) => (
            <button
              type="button"
              key={d.key}
              className={`slot-btn ${date === d.key ? 'selected' : ''}`}
              onClick={() => setDate(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {date && (
          <>
            <div className="step-label">{services.length > 0 ? '3' : '2'} · Pick a time</div>
            {!slots ? (
              <p style={{ color: 'var(--muted)' }}>Checking availability…</p>
            ) : slots.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>
                No openings that day — try another date{business.phone ? ` or call ${business.phone}` : ''}.
              </p>
            ) : (
              <div className="slot-grid">
                {slots.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`slot-btn ${time === t ? 'selected' : ''}`}
                    onClick={() => setTime(t)}
                  >
                    {fmtSlot(t)}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {time && (
          <>
            <div className="step-label">{services.length > 0 ? '4' : '3'} · Your details</div>
            <div className="card">
              <div className="field">
                <label>Your name *</label>
                <input className="input" value={form.name} onChange={set('name')} required />
              </div>
              <div className="form-row">
                <div className="field">
                  <label>Phone *</label>
                  <input className="input" type="tel" value={form.phone} onChange={set('phone')} required />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input className="input" type="email" value={form.email} onChange={set('email')} />
                </div>
              </div>
              <div className="field">
                <label>Service address</label>
                <input className="input" value={form.address} onChange={set('address')} placeholder="Where should we come?" />
              </div>
              <div className="field">
                <label>What’s going on? (optional)</label>
                <textarea className="input" value={form.notes} onChange={set('notes')} placeholder="Describe the issue…" />
              </div>
              {error && <div className="error-box">{error}</div>}
              <button className="btn btn-block btn-lg" disabled={busy}>
                {busy ? 'Sending…' : 'Request appointment'}
              </button>
              <div className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
                You’ll get a confirmation by text/email once {business.name} approves.
              </div>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
