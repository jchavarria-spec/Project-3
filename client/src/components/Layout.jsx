import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const links = [
  { to: '/app', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/app/calendar', label: 'Calendar', icon: '📅' },
  { to: '/app/jobs', label: 'Jobs', icon: '🧰' },
  { to: '/app/customers', label: 'Customers', icon: '👥' },
  { to: '/app/team', label: 'Team', icon: '🧑‍🔧' },
  { to: '/app/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout({ children }) {
  const { user, business, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">🔧 FieldBook</div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              <span>{l.icon}</span> {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="who">
            {user?.name}
            <br />
            <span style={{ fontSize: 12 }}>{business?.name}</span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: '#94a3b8', width: '100%' }}
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">{children}</main>

      <nav className="tabbar">
        {links.slice(0, 5).map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            <span className="icon">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
        <NavLink to="/app/settings">
          <span className="icon">⚙️</span>
          More
        </NavLink>
      </nav>
    </div>
  );
}
