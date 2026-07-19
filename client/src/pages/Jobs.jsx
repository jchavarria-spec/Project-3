import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import JobRow from '../components/JobRow.jsx';
import JobModal from '../components/JobModal.jsx';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function Jobs() {
  const [jobs, setJobs] = useState(null);
  const [status, setStatus] = useState('');
  const [range, setRange] = useState('upcoming'); // upcoming | past | all
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const now = new Date();
    if (range === 'upcoming') params.set('from', new Date(now.getTime() - 3600e3 * 4).toISOString());
    if (range === 'past') params.set('to', now.toISOString());
    api(`/jobs?${params}`).then((rows) => {
      if (range === 'past') rows.reverse();
      setJobs(rows);
    }).catch(() => setJobs([]));
  }, [status, range]);

  useEffect(load, [load]);

  return (
    <div>
      <div className="page-head">
        <h1>Jobs</h1>
        <button className="btn" onClick={() => setCreating(true)}>+ New job</button>
      </div>

      <div className="toolbar">
        <div className="chip-row">
          {['upcoming', 'past', 'all'].map((r) => (
            <button key={r} className={`chip ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
              {r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <div className="chip-row">
          {FILTERS.map((f) => (
            <button key={f.key} className={`chip ${status === f.key ? 'active' : ''}`} onClick={() => setStatus(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {!jobs ? (
          <div className="empty">Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="empty">No jobs match these filters.</div>
        ) : (
          jobs.map((j) => <JobRow key={j.id} job={j} onClick={setSelected} />)
        )}
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
