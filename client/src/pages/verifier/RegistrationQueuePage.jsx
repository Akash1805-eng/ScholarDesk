import { useState, useEffect } from 'react';
import api from '../../services/api.js';
import { formatDate, getErrorMessage } from '../../utils/helpers.js';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, Users } from 'lucide-react';

export default function RegistrationQueuePage() {
  const [registrations, setRegistrations] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState({});
  const [remarks, setRemarks] = useState({});
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/verifier/registrations?page=${page}&limit=${LIMIT}`);
      setRegistrations(res.data.registrations || []);
      setTotal(res.data.total || 0);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [page]);

  const handleDecision = async (userId, decision) => {
    setReviewing(r => ({ ...r, [userId]: true }));
    try {
      await api.patch(`/verifier/registrations/${userId}`, { decision, remarks: remarks[userId] || '' });
      toast.success(`Account ${decision}.`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReviewing(r => ({ ...r, [userId]: false }));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Pending Registrations</h1>
          <p className="page-subtitle">{total} student account{total !== 1 ? 's' : ''} awaiting approval.</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : registrations.length === 0 ? (
        <div className="empty-state">
          <Users size={40} />
          <div className="empty-state-title">No pending registrations</div>
          <p className="empty-state-desc">All registrations have been reviewed.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {registrations.map(user => {
            const master = user.studentMaster || {};
            return (
              <div key={user._id} className="card">
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{master.name || 'Unknown'}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {user.email} · {master.registerNumber} · {master.department} · Year {master.currentYear}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      Registered: {formatDate(user.createdAt, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 280 }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.8125rem' }}
                      placeholder="Remarks (required for rejection)"
                      value={remarks[user._id] || ''}
                      onChange={e => setRemarks(r => ({ ...r, [user._id]: e.target.value }))}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-success btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => handleDecision(user._id, 'approved')}
                        disabled={reviewing[user._id]}
                      >
                        <CheckCircle size={14} />
                        Approve
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => handleDecision(user._id, 'rejected')}
                        disabled={reviewing[user._id] || !remarks[user._id]}
                      >
                        <XCircle size={14} />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {total > LIMIT && (
            <div className="pagination">
              <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Page {page} of {Math.ceil(total / LIMIT)}</span>
              <button className="page-btn" disabled={page >= Math.ceil(total / LIMIT)} onClick={() => setPage(p => p + 1)}>›</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
