import { useState, useEffect } from 'react';
import api from '../../services/api.js';
import { getStatusLabel, getStatusClass } from '../../utils/helpers.js';
import {
  BarChart2,
  Users,
  Award,
  ClipboardList,
  Printer,
  CheckCircle,
  Clock,
  Filter,
  PieChart
} from 'lucide-react';

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const q = academicYear ? `?academicYear=${encodeURIComponent(academicYear)}` : '';
      const res = await api.get(`/admin/reports${q}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [academicYear]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const summary = data?.summary || {};
  const statusMap = data?.applicationsByStatus || {};
  const deptList = data?.applicationsByDepartment || [];

  const totalApplications = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const approvedCount = statusMap.approved || 0;
  const approvalRate = totalApplications > 0 ? ((approvedCount / totalApplications) * 100).toFixed(1) : 0;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div className="page-header-content">
          <h1 className="page-title">Institutional Analytics & Reports</h1>
          <p className="page-subtitle">Comprehensive institutional audit metrics, departmental breakdown, and approval performance.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={handlePrint} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Printer size={16} /> Print Report
          </button>
        </div>
      </div>

      {/* Filter by AY */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Filter size={18} color="var(--color-text-muted)" />
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Academic Year Filter:</span>
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: 160 }}
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
          >
            <option value="">All Academic Years</option>
            <option value="2026-2027">2026-2027</option>
            <option value="2025-2026">2025-2026</option>
          </select>
        </div>
      </div>

      {/* High-level KPIs */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
            <Users size={20} />
          </div>
          <div className="stat-card-value">{summary.totalStudents || 0}</div>
          <div className="stat-card-label">Enrolled Active Students</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--color-secondary-light)', color: 'var(--color-secondary)' }}>
            <ClipboardList size={20} />
          </div>
          <div className="stat-card-value">{totalApplications}</div>
          <div className="stat-card-label">Total Applications Logged</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <CheckCircle size={20} />
          </div>
          <div className="stat-card-value">{approvedCount} ({approvalRate}%)</div>
          <div className="stat-card-label">Scholarships Awarded</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
            <Clock size={20} />
          </div>
          <div className="stat-card-value">{summary.pendingRegistrations || 0}</div>
          <div className="stat-card-label">Pending Account Scrutiny</div>
        </div>
      </div>

      {/* Grid: Status Distribution & Department Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        {/* Status Distribution */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <PieChart size={18} color="var(--color-primary)" />
            Application Lifecycle Distribution
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              'submitted',
              'under_verification',
              'action_required',
              'verified',
              'under_final_approval',
              'approved',
              'rejected'
            ].map((st) => {
              const count = statusMap[st] || 0;
              const pct = totalApplications > 0 ? ((count / totalApplications) * 100).toFixed(1) : 0;
              return (
                <div key={st}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: '0.8125rem' }}>
                    <span className={`badge ${getStatusClass(st)}`}>{getStatusLabel(st)}</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-heading)' }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 6, backgroundColor: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: 'var(--color-primary)',
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BarChart2 size={18} color="var(--color-primary)" />
            Applications by Department
          </div>

          {deptList.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No application data recorded.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
                    <th style={{ padding: '8px 12px' }}>Department</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Applications</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Share %</th>
                  </tr>
                </thead>
                <tbody>
                  {deptList.map((d) => {
                    const pct = totalApplications > 0 ? ((d.count / totalApplications) * 100).toFixed(1) : 0;
                    return (
                      <tr key={d._id || 'Unknown'} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{d._id || 'Unassigned'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>{d.count}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
