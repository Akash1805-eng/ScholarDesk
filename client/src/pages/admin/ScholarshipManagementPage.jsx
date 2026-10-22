import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { formatDate, formatCurrency, getErrorMessage } from '../../utils/helpers.js';
import toast from 'react-hot-toast';
import { Award, Plus, Edit2, Search, CheckCircle, XCircle } from 'lucide-react';

export default function ScholarshipManagementPage() {
  const [scholarships, setScholarships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadScholarships = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        limit: 100,
        ...(search ? { search: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const res = await api.get(`/scholarships?${q.toString()}`);
      setScholarships(res.data.scholarships || []);
    } catch (err) {
      toast.error('Failed to load scholarships.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScholarships();
  }, [statusFilter]);

  const handleToggleActive = async (s) => {
    try {
      await api.put(`/scholarships/${s._id}`, {
        isActive: !s.isActive,
      });
      toast.success(`Scholarship marked as ${!s.isActive ? 'Active' : 'Inactive'}.`);
      loadScholarships();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadScholarships();
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div className="page-header-content">
          <h1 className="page-title">Scholarship Schemes Management</h1>
          <p className="page-subtitle">Configure institutional, merit, and category scholarship schemes, eligibility criteria, and rule versions.</p>
        </div>
        <Link to="/admin/scholarships/new" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> Create New Scholarship
        </Link>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search scholarship by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ flex: '0 1 160px' }}>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="open">Currently Open</option>
              <option value="closed">Closed / Past Deadline</option>
            </select>
          </div>

          <button type="submit" className="btn btn-secondary">
            <Search size={16} /> Search
          </button>
        </form>
      </div>

      {/* Scholarships Listing */}
      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : scholarships.length === 0 ? (
        <div className="card empty-state" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Award size={48} style={{ color: 'var(--color-text-muted)', margin: '0 auto 16px' }} />
          <div className="empty-state-title">No scholarships found</div>
          <p className="empty-state-desc" style={{ color: 'var(--color-text-muted)' }}>
            Create your first scholarship scheme to allow students to check eligibility and submit applications.
          </p>
          <Link to="/admin/scholarships/new" className="btn btn-primary" style={{ marginTop: 16 }}>
            Create Scholarship
          </Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Title & AY</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Award Amount</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Deadline</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Criteria & Docs</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Rules v</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {scholarships.map((s) => {
                  const isDeadlinePassed = new Date(s.deadline) <= new Date();
                  return (
                    <tr key={s._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-heading)' }}>{s.title}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                          AY: {s.academicYear}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {s.awardAmount ? formatCurrency(s.awardAmount) : 'Varies / Full'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                        <div style={{ color: isDeadlinePassed ? 'var(--color-error)' : 'inherit' }}>
                          {formatDate(s.deadline)}
                        </div>
                        {isDeadlinePassed && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-error)' }}>Deadline Passed</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        <div>{s.eligibilityCriteria?.length || 0} criteria rules</div>
                        <div>{s.requiredDocuments?.length || 0} required docs</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                        v{s.rulesVersion || 1}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => handleToggleActive(s)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                          title="Click to toggle active status"
                        >
                          {s.isActive ? (
                            <span className="badge badge-success" style={{ cursor: 'pointer' }}>Active</span>
                          ) : (
                            <span className="badge badge-neutral" style={{ cursor: 'pointer' }}>Inactive</span>
                          )}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <Link to={`/admin/scholarships/${s._id}/edit`} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Edit2 size={13} /> Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
