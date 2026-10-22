import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import {
  LayoutDashboard, User, FileText, BookOpen, Bell,
  LogOut, Sun, Moon, Menu, X, GraduationCap, ClipboardList
} from 'lucide-react';
import NotificationBadge from '../components/common/NotificationBadge.jsx';

const navItems = [
  { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/student/profile', label: 'My Profile', icon: User },
  { to: '/student/documents', label: 'Documents', icon: FileText },
  { to: '/student/scholarships', label: 'Scholarships', icon: BookOpen },
  { to: '/student/applications', label: 'My Applications', icon: ClipboardList },
  { to: '/student/notifications', label: 'Notifications', icon: Bell },
];

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (user?.role === 'student' && (user?.verificationStatus === 'pending' || user?.verificationStatus === 'rejected')) {
    return <Navigate to="/pending-approval" replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.email?.[0]?.toUpperCase() || 'S';

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} role="navigation" aria-label="Student navigation">
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GraduationCap size={20} color="#60a5fa" />
            <span className="sidebar-brand-name">Scholarship Desk</span>
          </div>
          <div className="sidebar-brand-sub">Student Portal</div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={16} />
              {label}
              {label === 'Notifications' && <NotificationBadge />}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-email truncate">{user?.email}</div>
              <div className="sidebar-user-role">Student</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4, padding: '0 4px' }}>
            <button className="btn btn-ghost btn-sm" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle dark mode">
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ flex: 1, justifyContent: 'flex-start', gap: 6 }}>
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="main-content" style={{ marginLeft: 'var(--sidebar-width)' }}>
        {/* Mobile topbar */}
        <header className="topbar" style={{ display: 'none' }} id="mobile-topbar">
          <button className="btn btn-ghost btn-icon" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <span className="topbar-title">Scholarship Desk</span>
        </header>

        <main id="main-content" className="page-content">
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; }
          #mobile-topbar { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
