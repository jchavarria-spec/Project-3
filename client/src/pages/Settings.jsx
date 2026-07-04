import { useEffect, useState } from 'react';
import { api, money } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Settings() {
  const { business, setBusiness, user } = useAuth();
  const isOwner = user?.role === 'owner';
  const [form, setForm] = useState(null);
  const [services, setServices] = useState([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [svcForm, setSvcForm] = useState({ name: '', duration_min: 60, price: '' });

  useEffect(() => {
    api('/business').then(setForm).catch((e) => setError(e.message));
    api('/services').then(setServices).catch(() => {});
  }, []);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    try {
      const updated = await api('/business', {
        method: 'PATCH',
        body: {
          name: form.name,
          phone: form.phone,
          email: form.email,
          address: form.address,
          logo_url: form.logo_url,
          slug: form.slug,
          booking_intro: form.booking_intro,
          open_time: form.open_time,
          close_time: form.close_time,
          timezone: form.timezone,
          google_review_url: form.google_review_url,
          yelp_review_url: form.yelp_review_url,
          sms_reminders_enabled: form.sms_reminders_enabled,
          email_reminders_enabled: form.email_reminders_enabled,
          review_requests_enabled: form.review_requests_enabled,
          reminder_hours_before: parseInt(form.reminder_hours_before, 10) || 24,
        },
      });
      setForm(updated);
      setBusiness(updated);
      setSaved(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function addService(e) {
    e.preventDefault();
    if (!svcForm.name) return;
    try {
      const s = await api('/services', {
        method: 'POST',
        body: {
          name: svcForm.name,
          duration_min: parseInt(svcForm.duration_min, 10) || 60,
          price_cents: Math.round(parseFloat(svcForm.price || '0') * 100),
        },
      });
      setServices((list) => [...list, s]);
      setSvcForm({ name: '', duration_min: 60, price: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeService(id) {
    if (!window.confirm('Remove this service from your booking page?')) return;
    await api(`/services/${id}`, { method: 'DELETE' });
    setServices((list) => list.filter((s) => s.id !== id));
  }

  if (!form) return <div className="spinner-page">Loading…</div>;

  const bookingUrl = `${window.location.origin}/book/${form.slug}`;

  return (
    <div>
      <div className="page-head">
        <h1>Settings</h1>
      </div>
      {error && <div className="error-box">{error}</div>}
      {saved && <div className="success-box">Settings saved.</div>}
      {!isOwner && <div className="error-box">Only the business owner can change settings.</div>}

      <form onSubmit={save}>
        <div className="card">
          <h2>Business profile</h2>
          <div className="form-row">
            <div className="field"><label>Business name</label><input className="input" value={form.name} onChange={set('name')} /></div>
            <div className="field"><label>Phone</label><input className="input" value={form.phone || ''} onChange={set('phone')} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Email</label><input className="input" value={form.email || ''} onChange={set('email')} /></div>
            <div className="field">
              <label>Timezone</label>
              <select className="input" value={form.timezone} onChange={set('timezone')}>
                {['America/New_York','America/Chicago','America/Denver','America/Phoenix','America/Los_Angeles','America/Anchorage','Pacific/Honolulu'].map((tz) => (
                  <option key={tz} value={tz}>{tz.replace('America/', '').replace('Pacific/', '').replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field"><label>Business address</label><input className="input" value={form.address || ''} onChange={set('address')} /></div>
        </div>

        <div className="card">
          <h2>Booking page</h2>
          <div className="field">
            <label>Your booking link</label>
            <div className="link-box"><span style={{ flex: 1 }}>{bookingUrl}</span></div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Link name (slug)</label>
              <input className="input" value={form.slug} onChange={set('slug')} />
              <div className="hint">Letters, numbers, and dashes only.</div>
            </div>
            <div className="field">
              <label>Logo URL</label>
              <input className="input" value={form.logo_url || ''} onChange={set('logo_url')} placeholder="https://…/logo.png" />
              <div className="hint">Paste a link to your logo image — it shows on your booking page and emails.</div>
            </div>
          </div>
          <div className="field">
            <label>Welcome message</label>
            <textarea className="input" value={form.booking_intro || ''} onChange={set('booking_intro')} />
          </div>
          <div className="form-row">
            <div className="field"><label>Open from</label><input className="input" type="time" value={form.open_time} onChange={set('open_time')} /></div>
            <div className="field"><label>Open until</label><input className="input" type="time" value={form.close_time} onChange={set('close_time')} /></div>
          </div>
        </div>

        <div className="card">
          <h2>Services on your booking page</h2>
          {services.filter((s) => s.active).map((s) => (
            <div key={s.id} className="job-row" style={{ cursor: 'default' }}>
              <div className="job-info">
                <div className="title">{s.name}</div>
                <div className="meta">{s.duration_min} min · {money(s.price_cents)}</div>
              </div>
              {isOwner && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeService(s.id)}>Remove</button>
              )}
            </div>
          ))}
          {isOwner && (
            <div className="form-row" style={{ gridTemplateColumns: '2fr 1fr 1fr auto', alignItems: 'end', marginTop: 12 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>New service</label>
                <input className="input" value={svcForm.name} onChange={(e) => setSvcForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Drain cleaning" />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Minutes</label>
                <input className="input" type="number" min="15" step="15" value={svcForm.duration_min} onChange={(e) => setSvcForm((f) => ({ ...f, duration_min: e.target.value }))} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Price ($)</label>
                <input className="input" type="number" min="0" step="0.01" value={svcForm.price} onChange={(e) => setSvcForm((f) => ({ ...f, price: e.target.value }))} />
              </div>
              <button type="button" className="btn" onClick={addService}>Add</button>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Reminders & reviews</h2>
          <div className="checkbox-row">
            <input type="checkbox" id="sms" checked={!!form.sms_reminders_enabled} onChange={set('sms_reminders_enabled')} />
            <label htmlFor="sms" style={{ margin: 0 }}>Send SMS reminders & confirmations (via Twilio)</label>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="em" checked={!!form.email_reminders_enabled} onChange={set('email_reminders_enabled')} />
            <label htmlFor="em" style={{ margin: 0 }}>Send email reminders & confirmations (via SendGrid)</label>
          </div>
          <div className="field" style={{ maxWidth: 260, marginTop: 8 }}>
            <label>Send reminder how long before?</label>
            <select className="input" value={form.reminder_hours_before} onChange={set('reminder_hours_before')}>
              <option value={2}>2 hours before</option>
              <option value={4}>4 hours before</option>
              <option value={24}>24 hours before</option>
              <option value={48}>48 hours before</option>
            </select>
          </div>
          <div className="checkbox-row" style={{ marginTop: 6 }}>
            <input type="checkbox" id="rev" checked={!!form.review_requests_enabled} onChange={set('review_requests_enabled')} />
            <label htmlFor="rev" style={{ margin: 0 }}>Ask for a review when a job is completed</label>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Google review link</label>
              <input className="input" value={form.google_review_url || ''} onChange={set('google_review_url')} placeholder="https://g.page/r/…/review" />
            </div>
            <div className="field">
              <label>Yelp review link</label>
              <input className="input" value={form.yelp_review_url || ''} onChange={set('yelp_review_url')} placeholder="https://www.yelp.com/writeareview/biz/…" />
            </div>
          </div>
          <div className="hint">Review requests are only sent if at least one link is filled in.</div>
        </div>

        {isOwner && (
          <button className="btn btn-lg" type="submit" style={{ marginTop: 16 }}>
            Save all settings
          </button>
        )}
      </form>
    </div>
  );
}
