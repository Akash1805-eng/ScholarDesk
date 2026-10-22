import { useState, useEffect } from 'react';
import api from '../../services/api.js';
import { Users, ClipboardList, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VerifierDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/verifier/registrations?limit=1'),
      api.get('/verifier/applications?status=submitted&limit=1'),
      api.get('/verifier/applications?status=under_verification&limit=1'),
      api.get('/verifier/applications?status=action_required&limit=1'),
    ]).then(([reg, submitted, underVer, action]) => {
      setData({
        pendingRegistrations: reg.data.total || 0,
        submitted: submitted.data.total || 0,
        underVerification: underVer.data.total || 0,
        actionRequired: action.data.total || 0,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Verifier Dashboard</h1>
          <p className="page-subtitle">Review student registrations and scholarship applications.</p>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { label: 'Pending Registrations', value: data.pendingRegistrations, icon: Users, color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', link: '/verifier/registrations' },
          { label: 'Submitted Applications', value: data.submitted, icon: ClipboardList, color: 'var(--color-info)', bg: 'var(--color-info-bg)', link: '/verifier/applications?status=submitted' },
          { label: 'Under Verification', value: data.underVerification, icon: Clock, color: 'var(--color-primary)', bg: 'var(--color-primary-light)', link: '/verifier/applications?status=under_verification' },
          { label: 'Awaiting Response', value: data.actionRequired, icon: CheckCircle, color: 'var(--color-error)', bg: 'var(--color-error-bg)', link: '/verifier/applications?status=action_required' },
        ].map(({ label, value, icon: Icon, color, bg, link }) => (
          <Link key={label} to={link} style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = color}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
            >
              <div className="stat-card-icon" style={{ background: bg, color }}><Icon size={18} /></div>
              <div className="stat-card-value">{value}</div>
              <div className="stat-card-label">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link to="/verifier/registrations" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <Users size={16} />Review Pending Registrations
            </Link>
            <Link to="/verifier/applications" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <ClipboardList size={16} />Process Application Queue
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
