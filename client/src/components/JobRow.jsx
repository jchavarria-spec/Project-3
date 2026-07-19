import { fmtDate, fmtTime } from '../api.js';

export default function JobRow({ job, onClick, showDate = true }) {
  return (
    <div className="job-row" onClick={() => onClick?.(job)}>
      <div className="job-time">
        <div className="t">{fmtTime(job.scheduled_at)}</div>
        {showDate && <div className="d">{fmtDate(job.scheduled_at)}</div>}
      </div>
      <div className="job-info">
        <div className="title">
          {job.customer_name}
          {job.service_name ? ` — ${job.service_name}` : ''}
        </div>
        <div className="meta">
          {job.technician_name ? (
            <>
              <span className="tech-dot" style={{ background: job.technician_color || '#94a3b8' }} /> {job.technician_name}
            </>
          ) : (
            'Unassigned'
          )}
          {job.address ? ` · ${job.address}` : ''}
        </div>
      </div>
      <span className={`badge ${job.status}`}>{job.status}</span>
    </div>
  );
}
