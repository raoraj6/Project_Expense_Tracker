import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import MotionButton from './MotionButton.jsx';

const ROUTES = [
  { to: '/', end: true, label: 'Dashboard' },
  { to: '/transactions', end: false, label: 'Transactions' },
  { to: '/insights', end: false, label: 'AI Insights' },
];

function NavItem({ to, end, children }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-pill"
              className="nav-pill"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          <span className="nav-label">{children}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">₹ Expense Tracker</div>
        <nav className="nav">
          {ROUTES.map((r) => (
            <NavItem key={r.to} to={r.to} end={r.end}>{r.label}</NavItem>
          ))}
        </nav>
        <div className="account">
          <span className="muted">{user?.name}</span>
          <MotionButton type="button" className="btn ghost" onClick={logout}>
            Sign out
          </MotionButton>
        </div>
      </header>
      <main className="content">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
