import { useState, useEffect } from 'react';
import api from '../../services/api.js';
import { formatDate, getErrorMessage } from '../../utils/helpers.js';
import toast from 'react-hot-toast';
import { UserCheck, Plus, Mail, Lock, Shield, Eye, EyeOff } from 'lucide-react';

export default function VerifierManagementPage() {
  const [verifiers, setVerifiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New verifier form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchVerifiers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/verifiers');
      setVerifiers(res.data.verifiers || []);
    } catch (err) {
      toast.error('Failed to load verifiers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifiers();
  }, []);

  const handleCreateVerifier = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and temporary password.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/admin/verifiers', {
        email: email.trim(),
        password,
      });
      toast.success('Verifier account created successfully.');
      setEmail('');
      setPassword('');
      setShowModal(false);
      fetchVerifiers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div className="page-header-content">
          <h1 className="page-title">Verifier Officer Accounts</h1>
          <p className="page-subtitle">Manage institutional officers assigned to scrutinize registrations and scholarship dossiers.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> Add Verification Officer
        </button>
      </div>

      {/* Verifiers List Table */}
      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : verifiers.length === 0 ? (
        <div className="card empty-state" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <UserCheck size={48} style={{ color: 'var(--color-text-muted)', margin: '0 auto 16px' }} />
          <div className="empty-state-title">No verifiers configured</div>
          <p className="empty-state-desc" style={{ color: 'var(--color-text-muted)' }}>
            Add verification officers to review registrations and verify student document submissions.
          </p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ marginTop: 16 }}>
            Create First Verifier
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Officer Email</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Role</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Account Status</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Created At</th>
                </tr>
              </thead>
              <tbody>
                {verifiers.map((v) => (
                  <tr key={v._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-heading)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Mail size={16} color="var(--color-text-muted)" />
                        {v.email}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                        {v.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-success">
                        Active & Verified
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      {formatDate(v.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 460, width: '100%', position: 'relative' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Shield size={20} color="var(--color-primary)" />
              Create Verifier Officer Account
            </div>

            <form onSubmit={handleCreateVerifier}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" htmlFor="verifier-email">Officer College Email</label>
                <input
                  id="verifier-email"
                  type="email"
                  className="form-input"
                  required
                  placeholder="officer@college.example"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" htmlFor="verifier-password">Initial Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="verifier-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    required
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
