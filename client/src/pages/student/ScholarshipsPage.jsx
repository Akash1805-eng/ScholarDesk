import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { formatDate, formatCurrency, getErrorMessage } from '../../utils/helpers.js';
import { BookOpen, Search, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function ScholarshipsPage() {
  const [scholarships, setScholarships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('open');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12, status: filter });
      if (search) params.set('search', search);
      const res = await api.get(`/scholarships?${params}`);
      setScholarships(res.data.scholarships || []);
      setTotalPages(res.data.totalPages || 1);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { setPage(1); }, [search, filter]);
  useEffect(() => { load(); }, [page, filter]);

  const handleSearch = (e) => { e.preventDefault(); setPage(1); load(); };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Scholarships</h1>
          <p className="page-subtitle">Browse and apply for available scholarships.</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6, flex: 1, minWidth: 240 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input type="text" className="form-input" style={{ paddingLeft: 30 }} placeholder="Search scholarships…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary">Search</button>
        </form>
        <div style={{ display: 'flex', gap: 4 }}>
          {['open', 'closed', ''].map(f => (
            <button key={f} className={`btn btn-${filter === f ? 'primary' : 'secondary'} btn-sm`}
              onClick={() => setFilter(f)}>
              {f === 'open' ? 'Open' : f === 'closed' ? 'Closed' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : scholarships.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={40} />
          <div className="empty-state-title">No scholarships found</div>
          <p className="empty-state-desc">Try adjusting your search or filter settings.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {scholarships.map(s => {
            const open = s.isOpen;
            const days = open ? Math.ceil((new Date(s.deadline) - new Date()) / 86400000) : 0;
            const appStatus = s.applicationStatus;

            return (
              <div key={s._id} className={`scholarship-card${!open ? ' scholarship-card-closed' : ''}`}>
                <div className="scholarship-card-header">
                  <div className="scholarship-title">{s.title}</div>
                  {s.awardAmount && <span className="scholarship-amount">{formatCurrency(s.awardAmount)}</span>}
                </div>

                {s.description && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {s.description}
                  </p>
                )}

                <div className="scholarship-meta">
                  <span>
                    <Clock size={12} />
                    {' '}Deadline: <span className={days <= 7 && open ? 'scholarship-deadline urgent' : ''}>
                      {formatDate(s.deadline)}
                      {open && ` (${days}d left)`}
                    </span>
                  </span>
                  <span>{s.academicYear}</span>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  {appStatus ? (
                    <span className={`status-badge status-${appStatus.status}`}>{appStatus.status.replace(/_/g, ' ')}</span>
                  ) : open ? (
                    <Link to={`/student/scholarships/${s._id}/apply`} className="btn btn-primary btn-sm">
                      Apply Now
                    </Link>
                  ) : (
                    <span className="badge badge-neutral"><XCircle size={11} /> Closed</span>
                  )}

                  <Link to={`/student/scholarships/${s._id}/apply`} className="btn btn-ghost btn-sm" style={{ fontSize: '0.8125rem' }}>
                    Details
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      )}
    </div>
  );
}
