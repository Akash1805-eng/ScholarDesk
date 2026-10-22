import { useState, useEffect, useRef } from 'react';
import api from '../../services/api.js';
import { getDocTypeLabel, formatDate, daysUntil, getErrorMessage, supportsExpiryDate } from '../../utils/helpers.js';
import toast from 'react-hot-toast';
import { FileText, Upload, Download, RefreshCw, AlertTriangle } from 'lucide-react';

const DOCUMENT_TYPES = [
  'identity_proof',
  'income_certificate',
  'community_certificate',
  'marksheet',
  'first_graduate_certificate',
  'disability_certificate',
  'bank_evidence',
  'bonafide_certificate',
];

function ExpiryBadge({ expiryDate, documentType }) {
  if (!expiryDate || isNaN(new Date(expiryDate).getTime())) {
    return <span className="doc-card-expiry" style={{ color: 'var(--color-text-muted)' }}>Expiry: Not applicable</span>;
  }
  const days = daysUntil(expiryDate);
  if (days == null) {
    return <span className="doc-card-expiry" style={{ color: 'var(--color-text-muted)' }}>Expiry: Not applicable</span>;
  }
  if (days < 0) return <span className="doc-card-expiry danger">⚠ Expired {formatDate(expiryDate)}</span>;
  if (days <= 7) return <span className="doc-card-expiry warning">⚠ Expires in {days}d ({formatDate(expiryDate)})</span>;
  if (days <= 30) return <span className="doc-card-expiry warning">Expires {formatDate(expiryDate)}</span>;
  return <span className="doc-card-expiry">Valid until {formatDate(expiryDate)}</span>;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const fileInputRef = useRef();

  const handleTypeChange = (newType) => {
    setSelectedType(newType);
    // If switching to a document type that does not support expiry, clear irrelevant expiry date
    if (!supportsExpiryDate(newType)) {
      setExpiryDate('');
    }
  };

  const loadDocs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/students/documents');
      setDocs(res.data.documents || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadDocs(); }, []);

  // Group active docs by type
  const activeDocs = docs.filter(d => d.isActive);
  const docsByType = {};
  for (const d of activeDocs) docsByType[d.documentType] = d;

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) { toast.error('Please select a file.'); return; }
    if (!selectedType) { toast.error('Please select a document type.'); return; }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('documentType', selectedType);
    if (issueDate) fd.append('issueDate', issueDate);
    if (expiryDate && supportsExpiryDate(selectedType)) fd.append('expiryDate', expiryDate);

    setUploading(true);
    try {
      await api.post('/students/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Document uploaded successfully!');
      setSelectedType('');
      setIssueDate('');
      setExpiryDate('');
      fileInputRef.current.value = '';
      await loadDocs();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (docId, filename) => {
    const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
    const url = `${apiBase}/students/documents/${docId}/download`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">My Documents</h1>
          <p className="page-subtitle">Upload and manage your scholarship documents. All documents are reused across applications.</p>
        </div>
      </div>

      {/* Upload form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Upload Document</div>
        <form onSubmit={handleUpload}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="doctype">Document Type</label>
              <select id="doctype" className="form-select" value={selectedType}
                onChange={e => handleTypeChange(e.target.value)} required>
                <option value="">Select type…</option>
                {DOCUMENT_TYPES.map(t => (
                  <option key={t} value={t}>{getDocTypeLabel(t)}{docsByType[t] ? ' (replace)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="issue_dt">Issue Date</label>
              <input id="issue_dt" type="date" className="form-input" value={issueDate}
                onChange={e => setIssueDate(e.target.value)} />
            </div>
            {supportsExpiryDate(selectedType) && (
              <div className="form-group">
                <label className="form-label" htmlFor="expiry_dt">Expiry Date</label>
                <input id="expiry_dt" type="date" className="form-input" value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="docfile">File</label>
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <Upload size={24} style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 500 }}>Click to select file</div>
              <div style={{ fontSize: '0.8125rem', marginTop: 4 }}>PDF, JPEG, PNG, or WebP — max 10 MB</div>
            </div>
            <input id="docfile" type="file" ref={fileInputRef} style={{ display: 'none' }}
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={e => {
                const f = e.target.files?.[0];
                const zone = document.querySelector('.upload-zone');
                if (f && zone) zone.textContent = `Selected: ${f.name}`;
              }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={uploading}>
            <Upload size={16} />
            {uploading ? 'Uploading…' : 'Upload Document'}
          </button>
          {docsByType[selectedType] && (
            <span className="badge badge-warning" style={{ marginLeft: 10 }}>
              <RefreshCw size={11} />
              This will replace v{docsByType[selectedType].version}
            </span>
          )}
        </form>
      </div>

      {/* Document library */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>Document Library</div>

        {loading ? (
          <div className="loading-overlay" style={{ padding: 32 }}>
            <div className="spinner" style={{ width: 24, height: 24 }} />
          </div>
        ) : activeDocs.length === 0 ? (
          <div className="empty-state">
            <FileText size={40} />
            <div className="empty-state-title">No documents yet</div>
            <p className="empty-state-desc">Upload your documents above to get started. They'll be automatically used in your scholarship applications.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {DOCUMENT_TYPES.map(type => {
              const doc = docsByType[type];
              if (!doc) {
                return (
                  <div key={type} className="doc-card" style={{ opacity: 0.55, borderStyle: 'dashed' }}>
                    <div className="doc-card-icon" style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}>
                      <FileText size={20} />
                    </div>
                    <div className="doc-card-content">
                      <div className="doc-card-type">{getDocTypeLabel(type)}</div>
                      <div className="doc-card-meta">Not uploaded</div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={type} className="doc-card">
                  <div className="doc-card-icon">
                    <FileText size={20} />
                  </div>
                  <div className="doc-card-content">
                    <div className="doc-card-type">{getDocTypeLabel(type)}</div>
                    <div className="doc-card-meta">
                      {doc.originalFilename} · v{doc.version}
                      {doc.issueDate && ` · Issued ${formatDate(doc.issueDate)}`}
                    </div>
                    <ExpiryBadge expiryDate={doc.expiryDate} />
                  </div>
                  <div className="doc-card-actions">
                    <button className="btn btn-ghost btn-icon btn-sm" title="Download"
                      onClick={() => handleDownload(doc._id, doc.originalFilename)}>
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
