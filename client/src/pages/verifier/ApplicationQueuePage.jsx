import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../services/api.js';
import { formatDate, getStatusLabel, getStatusClass } from '../../utils/helpers.js';
import { ClipboardList, ExternalLink, Filter } from 'lucide-react';

const STATUS_TABS = [
  { key: '', label: 'All Reviewable' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_verification', label: 'Under Verification' },
  { key: 'action_required', label: 'Action Required' },
  { key: 'verified', label: 'Verified' },
];

export default function ApplicationQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStatus = searchParams.get('status') || '';
  const [applications, setApplications] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const LIMIT = 15;

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page,
        limit: LIMIT,
        ...(currentStatus ? { status: currentStatus } : {}),
      });
      const res = await api.get(`/verifier/applications?${q.toString()}`);
      setApplications(res.data.applications || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [page, currentStatus]);

  const handleTabChange = (status) => {
    setPage(1);
    if (status) {
      setSearchParams({ status });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Application Review Queue</h1>
          <p className="page-subtitle">Verify student scholarship applications and evidence documents.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            className={`btn ${currentStatus === tab.key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : applications.length === 0 ? (
        <div className="card empty-state" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <ClipboardList size={48} style={{ color: 'var(--color-text-muted)', margin: '0 auto 16px' }} />
          <div className="empty-state-title" style={{ fontSize: '1.125rem', fontWeight: 600 }}>No applications found</div>
          <p className="empty-state-desc" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            There are currently no applications matching this filter status.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Student</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Scholarship</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Submitted</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => {
                  const studentName = app.officialSnapshot?.name || app.student?.email || 'Student';
                  const regNo = app.officialSnapshot?.registerNumber || '—';
                  const dept = app.officialSnapshot?.department || '—';
                  const year = app.officialSnapshot?.currentYear ? `Yr ${app.officialSnapshot.currentYear}` : '';

                  return (
                    <tr key={app._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-heading)' }}>{studentName}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                          {regNo} · {dept} {year}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 500 }}>{app.scholarship?.title || app.scholarshipSnapshot?.title || 'Scholarship'}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                          AY: {app.academicYear}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                        {formatDate(app.submittedAt || app.createdAt)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={`badge ${getStatusClass(app.status)}`}>
                          {getStatusLabel(app.status)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <Link to={`/verifier/applications/${app._id}`} className="btn btn-primary btn-sm">
                          Review <ExternalLink size={13} style={{ marginLeft: 4 }} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Page {page} of {totalPages} ({total} total)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
