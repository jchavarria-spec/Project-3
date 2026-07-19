import { useCallback, useEffect, useState } from 'react';
import { api, money } from '../api.js';
import { useAuth } from '../auth.jsx';
import JobRow from '../components/JobRow.jsx';
import JobModal from '../components/JobModal.jsx';

export default function Dashboard() {
  const { user, business } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function quickAction(job, status) {
    try {
      await api(`/jobs/${job.id}`, { method: 'PATCH', body: { status } });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const bookingUrl = `${window.location.origin}/book/${business?.slug}`;

  if (error) return <div className="error-box">{error}</div>;
  if (!data) return <div className="spinner-page">Loading your day…</div>;

  const firstName = user?.name?.split(' ')[0];
  const { stats } = data;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName} 👋</h1>
          <div className="page-sub">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <button className="btn" onClick={() => setCreating(true)}>+ New job</button>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="num">{stats.jobs_today}</div><div className="label">Jobs today</div></div>
        <div className="stat"><div className="num" style={{ color: stats.pending_requests ? 'var(--amber)' : undefined }}>{stats.pending_requests}</div><div className="label">Pending requests</div></div>
        <div className="stat"><div className="num">{stats.completed_this_week}</div><div className="label">Completed this week</div></div>
        <div className="stat"><div className="num">{money(stats.revenue_month_cents)}</div><div className="label">Revenue this month</div></div>
      </div>

      {data.pending.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--amber)' }}>
          <h2>🔔 New booking requests</h2>
          {data.pending.map((job) => (
            <div key={job.id} className="job-row" onClick={() => setSelected(job)}>
              <div className="job-info">
                <div className="title">{job.customer_name}{job.service_name ? ` — ${job.service_name}` : ''}</div>
                <div className="meta">
                  {new Date(job.scheduled_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  {job.address ? ` · ${job.address}` : ''}
                </div>
              </div>
              <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); quickAction(job, 'confirmed'); }}>
                Confirm
              </button>
              <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); quickAction(job, 'cancelled'); }}>
                Decline
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Today</h2>
        {data.today.length === 0 ? (
          <div className="empty">No jobs scheduled today. Enjoy the breather — or add one.</div>
        ) : (
          data.today.map((job) => <JobRow key={job.id} job={job} showDate={false} onClick={setSelected} />)
        )}
      </div>

      <div className="card">
        <h2>Coming up (next 14 days)</h2>
        {data.upcoming.length === 0 ? (
          <div className="empty">Nothing on the books yet. Share your booking link to fill the calendar.</div>
        ) : (
          data.upcoming.map((job) => <JobRow key={job.id} job={job} onClick={setSelected} />)
        )}
      </div>

      <div className="card">
        <h2>Your booking link</h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 10 }}>
          Put this on your website, Google Business profile, or text it to customers.
        </p>
        <div className="link-box">
          <span style={{ flex: 1 }}>{bookingUrl}</span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              navigator.clipboard?.writeText(bookingUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {selected && (
        <JobModal job={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />
      )}
      {creating && (
        <JobModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />
      )}
    </div>
  );
}
