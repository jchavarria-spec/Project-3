import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Calendar from './pages/Calendar.jsx';
import Jobs from './pages/Jobs.jsx';
import Customers from './pages/Customers.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import Team from './pages/Team.jsx';
import Settings from './pages/Settings.jsx';
import Booking from './pages/Booking.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner-page">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/book/:slug" element={<Booking />} />
      <Route path="/app" element={<Protected><Dashboard /></Protected>} />
      <Route path="/app/calendar" element={<Protected><Calendar /></Protected>} />
      <Route path="/app/jobs" element={<Protected><Jobs /></Protected>} />
      <Route path="/app/customers" element={<Protected><Customers /></Protected>} />
      <Route path="/app/customers/:id" element={<Protected><CustomerDetail /></Protected>} />
      <Route path="/app/team" element={<Protected><Team /></Protected>} />
      <Route path="/app/settings" element={<Protected><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
