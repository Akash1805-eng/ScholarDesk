import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { LayoutDashboard, Users, ClipboardList, LogOut, Sun, Moon, ShieldCheck } from 'lucide-react';

const navItems = [
  { to: '/verifier', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/verifier/registrations', label: 'Pending Registrations', icon: Users },
  { to: '/verifier/applications', label: 'Application Queue', icon: ClipboardList },
];

export default function VerifierLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <div className="app-shell">
      <aside className="sidebar" role="navigation" aria-label="Verifier navigation">
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={20} color="#34d399" />
            <span className="sidebar-brand-name">Scholarship Desk</span>
          </div>
          <div className="sidebar-brand-sub">Verifier Portal</div>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
              <Icon size={16} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{user?.email?.[0]?.toUpperCase()}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-email truncate">{user?.email}</div>
              <div className="sidebar-user-role">Verifier</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4, padding: '0 4px' }}>
            <button className="btn btn-ghost btn-sm" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ flex: 1, justifyContent: 'flex-start', gap: 6 }}>
              <LogOut size={14} />Logout
            </button>
          </div>
        </div>
      </aside>
      <div className="main-content" style={{ marginLeft: 'var(--sidebar-width)' }}>
        <main id="main-content" className="page-content"><Outlet /></main>
      </div>
      <style>{`@media (max-width: 768px) { .main-content { margin-left: 0 !important; } }`}</style>
    </div>
  );
}
