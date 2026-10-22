import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { BookOpen, FileText, ClipboardList, Bell, ChevronRight, TrendingUp } from 'lucide-react';
import { getStatusLabel, getStatusClass, formatDate, formatCurrency } from '../../utils/helpers.js';

export default function StudentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [profileRes, appsRes, scholarshipsRes, notifRes] = await Promise.all([
          api.get('/students/profile'),
          api.get('/applications/my'),
          api.get('/scholarships?status=open&limit=5'),
          api.get('/notifications?unreadOnly=true&limit=5'),
        ]);
        setData({
          profile: profileRes.data,
          applications: appsRes.data.applications || [],
          scholarships: scholarshipsRes.data.scholarships || [],
          notifications: notifRes.data.notifications || [],
          unreadCount: notifRes.data.unreadCount || 0,
        });
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;
  }

  const { profile, applications, scholarships, notifications, unreadCount } = data || {};
  const official = profile?.official;
  const profileData = profile?.profile;

  const profileComplete = !!(profileData?.cgpa && profileData?.familyIncome && profileData?.category);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Welcome back{official?.name ? `, ${official.name.split(' ')[0]}` : ''}! 👋</h1>
          <p className="page-subtitle">{official?.department} · Year {official?.currentYear} · {official?.academicYear}</p>
        </div>
        <div className="page-actions">
          <Link to="/student/scholarships" className="btn btn-primary">
            <BookOpen size={16} />
            Browse Scholarships
          </Link>
        </div>
      </div>

      {/* Profile completion banner */}
      {!profileComplete && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <TrendingUp size={16} />
          <div>
            <strong>Complete your profile</strong> — CGPA, family income, and category are needed to check scholarship eligibility.{' '}
            <Link to="/student/profile" style={{ fontWeight: 600, color: 'inherit' }}>Complete now →</Link>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--color-info-bg)' }}>
            <ClipboardList size={18} color="var(--color-info)" />
          </div>
          <div className="stat-card-value">{applications.length}</div>
          <div className="stat-card-label">Total Applications</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--color-success-bg)' }}>
            <BookOpen size={18} color="var(--color-success)" />
          </div>
          <div className="stat-card-value">{applications.filter(a => a.status === 'approved').length}</div>
          <div className="stat-card-label">Approved</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--color-warning-bg)' }}>
            <ClipboardList size={18} color="var(--color-warning)" />
          </div>
          <div className="stat-card-value">{applications.filter(a => a.status === 'action_required').length}</div>
          <div className="stat-card-label">Action Required</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--color-error-bg)' }}>
            <Bell size={18} color="var(--color-error)" />
          </div>
          <div className="stat-card-value">{unreadCount}</div>
          <div className="stat-card-label">Unread Notifications</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Recent Applications */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Applications</div>
              <div className="card-subtitle">{applications.length} total</div>
            </div>
            <Link to="/student/applications" className="btn btn-ghost btn-sm">
              View all <ChevronRight size={14} />
            </Link>
          </div>

          {applications.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <ClipboardList size={32} />
              <p className="empty-state-desc">No applications yet. Browse open scholarships to apply.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {applications.slice(0, 4).map(app => (
                <Link key={app._id} to={`/student/applications/${app._id}`}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', textDecoration: 'none', color: 'inherit', transition: 'var(--transition)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{app.scholarship?.title || 'Scholarship'}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Submitted {formatDate(app.submittedAt)}</div>
                  </div>
                  <span className={getStatusClass(app.status)}>{getStatusLabel(app.status)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Open Scholarships */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Open Scholarships</div>
              <div className="card-subtitle">Accepting applications now</div>
            </div>
            <Link to="/student/scholarships" className="btn btn-ghost btn-sm">
              View all <ChevronRight size={14} />
            </Link>
          </div>

          {scholarships.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <BookOpen size={32} />
              <p className="empty-state-desc">No open scholarships at this time.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {scholarships.map(s => (
                <div key={s._id} style={{ padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{s.title}</div>
                    {s.awardAmount && <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '0.875rem' }}>{formatCurrency(s.awardAmount)}</span>}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Deadline: {formatDate(s.deadline)}
                  </div>
                  <Link to={`/student/scholarships/${s._id}/apply`} className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
                    Apply now
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
