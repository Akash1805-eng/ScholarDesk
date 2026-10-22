import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import {
  Users,
  Upload,
  UserCheck,
  BookOpen,
  ClipboardList,
  Award,
  BarChart2,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { getStatusLabel, getStatusClass } from '../../utils/helpers.js';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/admin/reports');
        setData(res.data);
      } catch (err) {
        console.error('Failed to load admin reports', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const summary = data?.summary || {};
  const statusMap = data?.applicationsByStatus || {};
  const underFinalApprovalCount = statusMap.under_final_approval || 0;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Institutional Scholarship Administration</h1>
          <p className="page-subtitle">Central oversight, student master registry, scholarship workflows, and approvals.</p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <Link to="/admin/students" style={{ textDecoration: 'none' }}>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              <Users size={20} />
            </div>
            <div className="stat-card-value">{summary.totalStudents || 0}</div>
            <div className="stat-card-label">Active Enrolled Students</div>
          </div>
        </Link>

        <Link to="/verifier/registrations" style={{ textDecoration: 'none' }}>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
              <Clock size={20} />
            </div>
            <div className="stat-card-value">{summary.pendingRegistrations || 0}</div>
            <div className="stat-card-label">Pending Account Approvals</div>
          </div>
        </Link>

        <Link to="/admin/scholarships" style={{ textDecoration: 'none' }}>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: 'var(--color-secondary-light)', color: 'var(--color-secondary)' }}>
              <Award size={20} />
            </div>
            <div className="stat-card-value">{summary.totalActiveScholarships || 0}</div>
            <div className="stat-card-label">Active Scholarships</div>
          </div>
        </Link>

        <Link to="/admin/applications?status=under_final_approval" style={{ textDecoration: 'none' }}>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
              <CheckCircle size={20} />
            </div>
            <div className="stat-card-value">{underFinalApprovalCount}</div>
            <div className="stat-card-label">Awaiting Final Decision</div>
          </div>
        </Link>
      </div>

      {/* Applications Pipeline Status Breakdown */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={20} color="var(--color-primary)" />
            Application Lifecycle Pipeline
          </div>
          <Link to="/admin/applications" className="btn btn-secondary btn-sm">
            View All Applications <ArrowRight size={14} style={{ marginLeft: 4 }} />
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          {['submitted', 'under_verification', 'action_required', 'verified', 'under_final_approval', 'approved', 'rejected'].map(st => {
            const count = statusMap[st] || 0;
            return (
              <Link
                key={st}
                to={`/admin/applications?status=${st}`}
                style={{
                  textDecoration: 'none',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px',
                  backgroundColor: 'var(--color-surface)',
                  transition: 'border-color 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <span className={`badge ${getStatusClass(st)}`} style={{ alignSelf: 'flex-start' }}>
                  {getStatusLabel(st)}
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-heading)', marginTop: 4 }}>
                  {count}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Navigation Hub */}
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-heading)', marginBottom: 16 }}>
        Administrative Workspaces
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <Link to="/admin/students/import" className="card" style={{ textDecoration: 'none', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Upload size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-heading)' }}>Import Student Master</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Upload CSV/Excel of approved student roster</div>
          </div>
        </Link>

        <Link to="/admin/students" className="card" style={{ textDecoration: 'none', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: 'var(--color-secondary-light)', color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-heading)' }}>Student Master Registry</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Search and view institutional student records</div>
          </div>
        </Link>

        <Link to="/admin/verifiers" className="card" style={{ textDecoration: 'none', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <UserCheck size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-heading)' }}>Verifier Officer Accounts</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Manage verification officers and credentials</div>
          </div>
        </Link>

        <Link to="/admin/scholarships/new" className="card" style={{ textDecoration: 'none', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Award size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-heading)' }}>Create Scholarship</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Configure schemes, criteria, and required evidence</div>
          </div>
        </Link>

        <Link to="/admin/promote" className="card" style={{ textDecoration: 'none', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#ffedd5', color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-heading)' }}>Year End Promotion</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Batch advance student cohorts to the next academic year</div>
          </div>
        </Link>

        <Link to="/admin/reports" className="card" style={{ textDecoration: 'none', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart2 size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-heading)' }}>Institutional Reports</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Department analytics, approval rates & audit data</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
