import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import {
  LayoutDashboard, Users, Upload, UserCheck, BookOpen,
  ClipboardList, TrendingUp, BarChart2, LogOut, Sun, Moon, Settings
} from 'lucide-react';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { section: 'Student Management' },
  { to: '/admin/students', label: 'Student Master', icon: Users },
  { to: '/admin/students/import', label: 'Import Students', icon: Upload },
  { to: '/admin/promote', label: 'Year Promotion', icon: TrendingUp },
  { section: 'Staff' },
  { to: '/admin/verifiers', label: 'Verifier Accounts', icon: UserCheck },
  { section: 'Scholarships & Applications' },
  { to: '/admin/scholarships', label: 'Scholarships', icon: BookOpen },
  { to: '/admin/applications', label: 'Final Decisions', icon: ClipboardList },
  { section: 'Analytics' },
  { to: '/admin/reports', label: 'Reports', icon: BarChart2 },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <div className="app-shell">
      <aside className="sidebar" role="navigation" aria-label="Admin navigation">
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={20} color="#f59e0b" />
            <span className="sidebar-brand-name">Scholarship Desk</span>
          </div>
          <div className="sidebar-brand-sub">Admin Portal</div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item, idx) =>
            item.section ? (
              <div key={idx} className="sidebar-section-label">{item.section}</div>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
                <item.icon size={16} />{item.label}
              </NavLink>
            )
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar" style={{ background: '#f59e0b' }}>{user?.email?.[0]?.toUpperCase()}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-email truncate">{user?.email}</div>
              <div className="sidebar-user-role">Administrator</div>
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
