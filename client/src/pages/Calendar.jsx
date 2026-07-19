import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fmtTime } from '../api.js';
import JobRow from '../components/JobRow.jsx';
import JobModal from '../components/JobModal.jsx';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayKey = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function Calendar() {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [jobs, setJobs] = useState([]);
  const [team, setTeam] = useState([]);
  const [techFilter, setTechFilter] = useState('');
  const [selectedDay, setSelectedDay] = useState(dayKey(new Date()));
  const [selectedJob, setSelectedJob] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), -7);
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 8);
    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    if (techFilter) params.set('technician_id', techFilter);
    api(`/jobs?${params}`).then(setJobs).catch(() => {});
  }, [cursor, techFilter]);

  useEffect(load, [load]);
  useEffect(() => {
    api('/team').then((t) => setTeam(t.filter((m) => m.active))).catch(() => {});
  }, []);

  const byDay = useMemo(() => {
    const map = {};
    for (const j of jobs) {
      if (j.status === 'cancelled') continue;
      const k = dayKey(new Date(j.scheduled_at));
      (map[k] ||= []).push(j);
    }
    return map;
  }, [jobs]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const out = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [cursor]);

  const todayKey = dayKey(new Date());
  const dayJobs = (byDay[selectedDay] || []).slice().sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  return (
    <div>
      <div className="page-head">
        <h1>Calendar</h1>
        <button className="btn" onClick={() => setCreating(true)}>+ New job</button>
      </div>

      {team.length > 1 && (
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <button className={`chip ${!techFilter ? 'active' : ''}`} onClick={() => setTechFilter('')}>All team</button>
          {team.map((m) => (
            <button key={m.id} className={`chip ${String(m.id) === techFilter ? 'active' : ''}`} onClick={() => setTechFilter(String(m.id))}>
              <span className="tech-dot" style={{ background: m.color, marginRight: 6 }} />
              {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <div className="cal-head">
          <button className="btn btn-secondary btn-sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>←</button>
          <div className="month">{cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
          <button className="btn btn-secondary btn-sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>→</button>
        </div>
        <div className="cal-grid">
          {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
          {cells.map((d) => {
            const k = dayKey(d);
            const list = byDay[k] || [];
            const other = d.getMonth() !== cursor.getMonth();
            return (
              <div
                key={k}
                className={`cal-cell ${other ? 'other' : ''} ${k === todayKey ? 'today' : ''} ${k === selectedDay ? 'selected' : ''}`}
                onClick={() => setSelectedDay(k)}
              >
                <div className="daynum">{d.getDate()}</div>
                {list.slice(0, 3).map((j) => (
                  <div
                    key={j.id}
                    className="cal-chip"
                    style={{ background: j.technician_color || 'var(--primary)', opacity: j.status === 'completed' ? 0.55 : 1 }}
                    onClick={(e) => { e.stopPropagation(); setSelectedJob(j); }}
                  >
                    {fmtTime(j.scheduled_at)} {j.customer_name}
                  </div>
                ))}
                {list.length > 3 && <div className="cal-more">+{list.length - 3} more</div>}
                <div className="dots">
                  {list.slice(0, 6).map((j) => (
                    <span key={j.id} className="dot" style={{ background: j.technician_color || 'var(--primary)' }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>
          {new Date(`${selectedDay}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </h2>
        {dayJobs.length === 0 ? (
          <div className="empty">No jobs this day. Tap “New job” to schedule one.</div>
        ) : (
          dayJobs.map((j) => <JobRow key={j.id} job={j} showDate={false} onClick={setSelectedJob} />)
        )}
      </div>

      {selectedJob && (
        <JobModal job={selectedJob} onClose={() => setSelectedJob(null)} onSaved={() => { setSelectedJob(null); load(); }} />
      )}
      {creating && (
        <JobModal
          initialDate={new Date(`${selectedDay}T09:00:00`)}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load(); }}
        />
      )}
    </div>
  );
}
