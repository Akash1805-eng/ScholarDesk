import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  formatDate,
  formatCurrency,
  getStatusLabel,
  getStatusClass,
  getDocTypeLabel,
  getErrorMessage
} from '../../utils/helpers.js';
import toast from 'react-hot-toast';
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  AlertCircle,
  FileText,
  Clock,
  User,
  BookOpen,
  DollarSign,
  Building,
  ShieldCheck,
  ChevronLeft,
  ExternalLink
} from 'lucide-react';

export default function ApplicationReviewAdminPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [application, setApplication] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/applications/${id}`);
      setApplication(res.data.application);
      setLogs(res.data.logs || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleVerifierTransition = async (newStatus) => {
    if (newStatus === 'action_required' && !remarks.trim()) {
      toast.error('Remarks are required when requesting student corrections.');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/verifier/applications/${id}/status`, {
        status: newStatus,
        remarks: remarks.trim(),
      });
      toast.success(`Application updated to ${getStatusLabel(newStatus)}.`);
      setRemarks('');
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminDecision = async (decision) => {
    if (decision === 'rejected' && !remarks.trim()) {
      toast.error('Please specify a rejection reason in the remarks field.');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/admin/applications/${id}/decision`, {
        decision,
        remarks: remarks.trim(),
      });
      toast.success(`Application has been ${decision}.`);
      setRemarks('');
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="card empty-state" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <AlertCircle size={48} style={{ color: 'var(--color-error)', margin: '0 auto 16px' }} />
        <div className="empty-state-title">Application not found</div>
        <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ marginTop: 16 }}>
          Go Back
        </button>
      </div>
    );
  }

  const { officialSnapshot, profileSnapshot, scholarshipSnapshot, documentRefs, customAnswers, status } = application;
  const isAdmin = user?.role === 'admin';
  const isVerifier = user?.role === 'verifier';
  const backUrl = isAdmin ? '/admin/applications' : '/verifier/applications';

  return (
    <div>
      {/* Top bar */}
      <div style={{ marginBottom: 16 }}>
        <Link to={backUrl} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ChevronLeft size={16} /> Back to queue
        </Link>
      </div>

      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="page-header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              {officialSnapshot?.name || application.student?.email}
            </h1>
            <span className={`badge ${getStatusClass(status)}`} style={{ fontSize: '0.875rem', padding: '4px 10px' }}>
              {getStatusLabel(status)}
            </span>
          </div>
          <p className="page-subtitle" style={{ marginTop: 4 }}>
            Scholarship: <strong>{scholarshipSnapshot?.title || application.scholarship?.title}</strong> · Academic Year: {application.academicYear} · Submitted: {formatDate(application.submittedAt)}
          </p>
        </div>
      </div>

      {/* Review Actions Panel */}
      <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--color-primary)' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <ShieldCheck size={20} color="var(--color-primary)" />
          Review & Decision Desk
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label" htmlFor="reviewer-remarks">
            Reviewer Remarks / Feedback Note
          </label>
          <textarea
            id="reviewer-remarks"
            className="form-input"
            rows={2}
            placeholder="Add remarks, missing evidence details, or reason for decision..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {/* Verifier status transitions */}
          {status === 'submitted' && (
            <button
              className="btn btn-primary"
              disabled={submitting}
              onClick={() => handleVerifierTransition('under_verification')}
            >
              <Clock size={16} /> Mark Under Verification
            </button>
          )}

          {status === 'under_verification' && (
            <>
              <button
                className="btn btn-success"
                disabled={submitting}
                onClick={() => handleVerifierTransition('verified')}
              >
                <CheckCircle size={16} /> Verify & Pass Documents
              </button>
              <button
                className="btn btn-danger"
                disabled={submitting}
                onClick={() => handleVerifierTransition('action_required')}
              >
                <AlertCircle size={16} /> Request Student Corrections
              </button>
            </>
          )}

          {status === 'action_required' && (
            <button
              className="btn btn-secondary"
              disabled={submitting}
              onClick={() => handleVerifierTransition('under_verification')}
            >
              <Clock size={16} /> Re-open Verification
            </button>
          )}

          {status === 'verified' && (
            <button
              className="btn btn-primary"
              disabled={submitting}
              onClick={() => handleVerifierTransition('under_final_approval')}
            >
              <ArrowRight size={16} /> Forward for Final Approval
            </button>
          )}

          {/* Admin Final Decision */}
          {isAdmin && status === 'under_final_approval' && (
            <>
              <button
                className="btn btn-success"
                disabled={submitting}
                onClick={() => handleAdminDecision('approved')}
              >
                <CheckCircle size={16} /> Final Approval & Award
              </button>
              <button
                className="btn btn-danger"
                disabled={submitting}
                onClick={() => handleAdminDecision('rejected')}
              >
                <XCircle size={16} /> Reject Application
              </button>
            </>
          )}

          {status === 'approved' && (
            <span style={{ color: 'var(--color-success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={18} /> Scholarship Approved
            </span>
          )}

          {status === 'rejected' && (
            <span style={{ color: 'var(--color-error)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <XCircle size={18} /> Scholarship Rejected
            </span>
          )}
        </div>
      </div>

      {/* Main Grid: Data & Details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Official College Record */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <User size={18} color="var(--color-primary)" />
            Official Institutional Record
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Register Number</div>
              <div style={{ fontWeight: 600 }}>{officialSnapshot?.registerNumber || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Department</div>
              <div style={{ fontWeight: 600 }}>{officialSnapshot?.department || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Current Year</div>
              <div style={{ fontWeight: 600 }}>Year {officialSnapshot?.currentYear || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Academic Year</div>
              <div style={{ fontWeight: 600 }}>{officialSnapshot?.academicYear || '—'}</div>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>College Email</div>
              <div style={{ fontWeight: 500 }}>{officialSnapshot?.collegeEmail || application.student?.email || '—'}</div>
            </div>
          </div>
        </div>

        {/* Student Academic & Socio-economic */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BookOpen size={18} color="var(--color-primary)" />
            Academic & Category Profile
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Community Category</div>
              <div style={{ fontWeight: 600 }}>{profileSnapshot?.category || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Religion</div>
              <div style={{ fontWeight: 600 }}>{profileSnapshot?.religion || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Annual Family Income</div>
              <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                {profileSnapshot?.annualIncome != null ? formatCurrency(profileSnapshot.annualIncome) : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Current CGPA</div>
              <div style={{ fontWeight: 600 }}>{profileSnapshot?.currentCgpa ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>10th Percentage</div>
              <div style={{ fontWeight: 500 }}>{profileSnapshot?.marks10th ? `${profileSnapshot.marks10th}%` : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>12th Percentage</div>
              <div style={{ fontWeight: 500 }}>{profileSnapshot?.marks12th ? `${profileSnapshot.marks12th}%` : '—'}</div>
            </div>
          </div>
        </div>

        {/* Bank & Disbursement info */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Building size={18} color="var(--color-primary)" />
            Bank & Account Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Bank Name</div>
              <div style={{ fontWeight: 600 }}>{profileSnapshot?.bankName || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>IFSC Code</div>
              <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{profileSnapshot?.bankIfsc || '—'}</div>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Account Number</div>
              <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{profileSnapshot?.bankAccountNo || '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Uploaded Documents & Evidence */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <FileText size={18} color="var(--color-primary)" />
          Attached Verification Documents ({documentRefs?.length || 0})
        </div>

        {documentRefs && documentRefs.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {documentRefs.map((doc, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--color-surface-hover)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{getDocTypeLabel(doc.documentType)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {doc.originalFilename} (v{doc.version || 1})
                  </div>
                </div>
                <a
                  href={`${(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')}/students/documents/${doc.documentId}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  View <ExternalLink size={13} />
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No documents attached to snapshot.</div>
        )}
      </div>

      {/* Custom Questions & Answers */}
      {customAnswers && Object.keys(customAnswers).length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Specific Questionnaire Responses</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(customAnswers).map(([key, val]) => (
              <div key={key} style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{key}</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{String(val)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Timeline */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Clock size={18} color="var(--color-primary)" />
          Application Audit Trail
        </div>
        {logs && logs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {logs.map((log) => (
              <div key={log._id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary)',
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      {log.action?.replace('_', ' ').toUpperCase()} ({log.actorRole})
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {formatDate(log.createdAt, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {log.remarks && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text)', marginTop: 4, fontStyle: 'italic' }}>
                      "{log.remarks}"
                    </div>
                  )}
                  {log.previousStatus && log.newStatus && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {getStatusLabel(log.previousStatus)} → {getStatusLabel(log.newStatus)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No audit entries recorded yet.</div>
        )}
      </div>
    </div>
  );
}
