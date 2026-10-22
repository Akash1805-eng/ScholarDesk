import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api.js';
import { getStatusLabel, getStatusClass, formatDate, getDocTypeLabel, getErrorMessage } from '../../utils/helpers.js';
import toast from 'react-hot-toast';
import { FileText, Send, AlertTriangle } from 'lucide-react';

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [correctionRemarks, setCorrectionRemarks] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  const load = () => {
    api.get(`/applications/${id}`).then(res => {
      setApp(res.data.application);
      setLogs(res.data.logs || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleSubmitCorrection = async () => {
    setSubmittingCorrection(true);
    try {
      await api.patch(`/applications/${id}/corrections`, { remarks: correctionRemarks });
      toast.success('Corrections submitted.');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmittingCorrection(false);
    }
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;
  if (!app) return <div className="page-content"><p>Application not found.</p></div>;

  const snap = app.officialSnapshot || {};
  const profSnap = app.profileSnapshot || {};

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">{app.scholarship?.title || 'Application'}</h1>
          <p className="page-subtitle">Academic Year {app.academicYear} · Submitted {formatDate(app.submittedAt)}</p>
        </div>
        <span className={getStatusClass(app.status)}>{getStatusLabel(app.status)}</span>
      </div>

      {/* Action required banner */}
      {app.status === 'action_required' && (
        <div className="alert alert-error">
          <AlertTriangle size={16} />
          <div>
            <strong>Action Required</strong>
            {app.verifierRemarks && <><br />Verifier notes: {app.verifierRemarks}</>}
          </div>
        </div>
      )}

      {/* Approved banner */}
      {app.status === 'approved' && (
        <div className="alert alert-success">🎉 Congratulations! Your application has been approved.
          {app.adminRemarks && <><br /><em>{app.adminRemarks}</em></>}
        </div>
      )}

      {/* Rejected banner */}
      {app.status === 'rejected' && (
        <div className="alert alert-error">
          Your application was not approved.
          {app.adminRemarks && <><br /><strong>Reason:</strong> {app.adminRemarks}</>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        {/* Snapshot */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Submitted Details</div>
          <table className="table" style={{ fontSize: '0.875rem' }}>
            <tbody>
              {[
                ['Name', snap.name],
                ['Register No.', snap.registerNumber],
                ['Email', snap.collegeEmail],
                ['Department', snap.department],
                ['Year', snap.currentYear ? `Year ${snap.currentYear}` : null],
                ['CGPA', profSnap.cgpa],
                ['Category', profSnap.category],
                ['Family Income', profSnap.familyIncome != null ? `₹${Number(profSnap.familyIncome).toLocaleString('en-IN')}` : null],
              ].filter(([, v]) => v != null).map(([k, v]) => (
                <tr key={k}><td style={{ color: 'var(--color-text-muted)', width: 160 }}>{k}</td><td>{String(v)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Documents */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Submitted Documents</div>
          {app.documentRefs?.length === 0 ? (
            <p className="text-muted text-sm">No documents.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(app.documentRefs || []).map((doc, i) => (
                <div key={i} className="doc-card">
                  <div className="doc-card-icon"><FileText size={16} /></div>
                  <div className="doc-card-content">
                    <div className="doc-card-type">{getDocTypeLabel(doc.documentType)}</div>
                    <div className="doc-card-meta">v{doc.version} · {formatDate(doc.uploadedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom answers */}
      {Object.keys(app.customAnswers || {}).length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Your Answers</div>
          {Object.entries(app.customAnswers).map(([key, val]) => (
            <div key={key} className="form-group">
              <label className="form-label">{key}</label>
              <textarea className="form-textarea" value={val} readOnly style={{ minHeight: 60, background: 'var(--color-surface-hover)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Correction panel */}
      {app.status === 'action_required' && (
        <div className="card" style={{ marginTop: 16, border: '1px solid var(--color-error)' }}>
          <div className="card-title" style={{ marginBottom: 12, color: 'var(--color-error)' }}>Submit Corrections</div>
          <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
            Upload updated documents in the <Link to="/student/documents">Documents</Link> section, then submit your response here.
          </p>
          <div className="form-group">
            <label className="form-label" htmlFor="correction-remarks">Remarks (optional)</label>
            <textarea id="correction-remarks" className="form-textarea" placeholder="Explain the corrections made…"
              value={correctionRemarks} onChange={e => setCorrectionRemarks(e.target.value)} style={{ minHeight: 80 }} />
          </div>
          <button className="btn btn-primary" onClick={handleSubmitCorrection} disabled={submittingCorrection}>
            <Send size={16} />
            {submittingCorrection ? 'Submitting…' : 'Submit Corrections'}
          </button>
        </div>
      )}

      {/* Audit timeline */}
      {logs.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Application History</div>
          <div className="timeline">
            {logs.map((log, i) => (
              <div key={i} className="timeline-item">
                <div className="timeline-icon" style={{
                  background: log.action === 'approved' ? 'var(--color-success-bg)'
                    : log.action === 'rejected' ? 'var(--color-error-bg)'
                    : 'var(--color-info-bg)',
                  color: log.action === 'approved' ? 'var(--color-success)'
                    : log.action === 'rejected' ? 'var(--color-error)'
                    : 'var(--color-info)',
                }}>
                  {log.actorRole?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="timeline-content">
                  <div className="timeline-title">{log.action.replace(/_/g, ' ')}: {log.previousStatus} → {log.newStatus}</div>
                  <div className="timeline-meta">{formatDate(log.createdAt, { hour: '2-digit', minute: '2-digit' })} · {log.actorRole}</div>
                  {log.remarks && <div className="timeline-remarks">"{log.remarks}"</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
