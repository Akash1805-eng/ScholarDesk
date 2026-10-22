import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import { formatDate, formatCurrency, getDocTypeLabel, getErrorMessage } from '../../utils/helpers.js';
import toast from 'react-hot-toast';
import { FileText, CheckCircle, AlertTriangle, Send, Lock, ChevronDown, ChevronUp } from 'lucide-react';

export default function ApplicationReviewPage() {
  const { id: scholarshipId } = useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  useEffect(() => {
    api.post('/applications/preview', { scholarshipId }).then(res => {
      setPreview(res.data);
      setLoading(false);
    }).catch(err => {
      const errData = err?.response?.data;
      if (errData?.code === 'APPLICATION_EXISTS') {
        toast('You already have an application for this scholarship.', { icon: 'ℹ️' });
        navigate(`/student/applications/${errData.applicationId}`);
        return;
      }
      setError(errData?.message || 'Failed to load application preview.');
      setLoading(false);
    });
  }, [scholarshipId]);

  const handleSubmit = async () => {
    if (!confirmed) { toast.error('Please review and confirm the application details.'); return; }
    setSubmitting(true);
    try {
      const res = await api.post('/applications', {
        scholarshipId,
        customAnswers: answers,
        confirmed: true,
      });
      toast.success('Application submitted successfully!');
      navigate(`/student/applications/${res.data.application._id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  if (error) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Apply for Scholarship</h1>
        </div>
        <div className="alert alert-error"><AlertTriangle size={16} />{error}</div>
        {preview?.reasons?.length > 0 && (
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Eligibility Issues</div>
            {preview.reasons.map((r, i) => (
              <div key={i} className="alert alert-warning">
                <AlertTriangle size={14} />{r.explanation}
              </div>
            ))}
            {preview.missingFields?.length > 0 && (
              <a href="/student/profile" className="btn btn-primary" style={{ marginTop: 8 }}>
                Complete your profile →
              </a>
            )}
          </div>
        )}
        <button className="btn btn-secondary" onClick={() => navigate('/student/scholarships')} style={{ marginTop: 16 }}>
          ← Back to scholarships
        </button>
      </div>
    );
  }

  const { official, profile, scholarship, availableDocuments, missingDocuments, eligibility } = preview;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Review Application</h1>
          <p className="page-subtitle">{scholarship.title} · {scholarship.academicYear}</p>
        </div>
      </div>

      {/* Eligibility pass banner */}
      <div className="alert alert-success">
        <CheckCircle size={16} />
        You meet all eligibility criteria for this scholarship.
      </div>

      {/* Missing documents warning */}
      {missingDocuments.length > 0 && (
        <div className="alert alert-error">
          <AlertTriangle size={16} />
          <div>
            <strong>Missing required documents:</strong> {missingDocuments.map(d => getDocTypeLabel(d)).join(', ')}.{' '}
            <a href="/student/documents" style={{ fontWeight: 600, color: 'inherit' }}>Upload them →</a>
          </div>
        </div>
      )}

      {/* Official info (read-only snapshot) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">Official Details (Autofilled)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            <Lock size={12} />Read-only — from institution records
          </div>
        </div>
        <div className="form-grid">
          {Object.entries({
            'Name': official.name,
            'Register No.': official.registerNumber,
            'College Email': official.collegeEmail,
            'Department': official.department,
            'Year': `Year ${official.currentYear}`,
            'Academic Year': official.academicYear,
          }).map(([k, v]) => (
            <div className="form-group" key={k}>
              <label className="form-label">{k}</label>
              <input className="form-input" value={v} readOnly />
            </div>
          ))}
        </div>

        {/* Profile snapshot */}
        <button className="btn btn-ghost btn-sm" onClick={() => setShowDetails(d => !d)} style={{ marginTop: 4 }}>
          {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showDetails ? 'Hide' : 'Show'} profile details
        </button>
        {showDetails && (
          <div className="form-grid" style={{ marginTop: 12 }}>
            {Object.entries({
              'CGPA': profile?.cgpa,
              'Annual Income': profile?.familyIncome != null ? `₹${Number(profile.familyIncome).toLocaleString('en-IN')}` : null,
              'Category': profile?.category,
              'Gender': profile?.gender,
              'First Graduate': profile?.isFirstGraduate != null ? (profile.isFirstGraduate ? 'Yes' : 'No') : null,
            }).filter(([, v]) => v != null).map(([k, v]) => (
              <div className="form-group" key={k}>
                <label className="form-label">{k}</label>
                <input className="form-input" value={String(v)} readOnly />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents attached */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Documents Attached</div>
        {Object.keys(availableDocuments).length === 0 ? (
          <p className="text-muted text-sm">No documents attached.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(availableDocuments).map(([type, doc]) => (
              <div key={type} className="doc-card">
                <div className="doc-card-icon"><FileText size={18} /></div>
                <div className="doc-card-content">
                  <div className="doc-card-type">{getDocTypeLabel(type)}</div>
                  <div className="doc-card-meta">{doc.originalFilename} · v{doc.version}</div>
                </div>
                <CheckCircle size={16} color="var(--color-success)" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom questions */}
      {scholarship.customQuestions?.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Additional Questions</div>
          {scholarship.customQuestions.map(q => (
            <div className="form-group" key={q.key}>
              <label className="form-label">
                {q.label}
                {q.required && <span style={{ color: 'var(--color-error)' }}> *</span>}
              </label>
              {q.type === 'textarea' ? (
                <textarea className="form-textarea" placeholder={q.helpText || ''}
                  value={answers[q.key] || ''}
                  onChange={e => setAnswers(a => ({ ...a, [q.key]: e.target.value }))}
                  required={q.required} />
              ) : (
                <input type="text" className="form-input" placeholder={q.helpText || ''}
                  value={answers[q.key] || ''}
                  onChange={e => setAnswers(a => ({ ...a, [q.key]: e.target.value }))}
                  required={q.required} />
              )}
              {q.helpText && <span className="form-hint">{q.helpText}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Confirmation */}
      <div className="card" style={{ marginBottom: 24, background: confirmed ? 'var(--color-success-bg)' : 'var(--color-surface)', border: `1px solid ${confirmed ? 'var(--color-success)' : 'var(--color-border)'}` }}>
        <label className="checkbox-group" style={{ fontSize: '0.9375rem', fontWeight: 500, cursor: 'pointer' }}>
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} id="confirm-check" />
          I have reviewed all the information above. It is accurate and I wish to submit this application.
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/student/scholarships')}>
          Cancel
        </button>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleSubmit}
          disabled={!confirmed || submitting || missingDocuments.length > 0}
        >
          <Send size={16} />
          {submitting ? 'Submitting…' : 'Submit Application'}
        </button>
      </div>
    </div>
  );
}
