import { useState, useEffect, useRef } from 'react';
import api from '../../services/api.js';
import { formatDate, getErrorMessage } from '../../utils/helpers.js';
import toast from 'react-hot-toast';
import {
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Clock,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

export default function StudentImportPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState(null);
  const [history, setHistory] = useState([]);
  const fileInputRef = useRef(null);

  const loadHistory = async () => {
    try {
      const res = await api.get('/admin/students/import/history');
      setHistory(res.data.history || []);
    } catch {}
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewData(null);
      setCommitResult(null);
    }
  };

  const handleUploadPreview = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a CSV or Excel file.');
      return;
    }

    setUploading(true);
    setCommitResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/admin/students/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPreviewData(res.data);
      toast.success('File analyzed successfully. Review preview below.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!previewData?.importId) return;
    setCommitting(true);
    try {
      const res = await api.post('/admin/students/import/confirm', {
        importId: previewData.importId,
      });
      setCommitResult(res.data);
      setPreviewData(null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success(`Successfully imported ${res.data.insertedCount || res.data.importedCount || 0} students!`);
      loadHistory();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCommitting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/admin/students/import/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'student_import_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Failed to download template.');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div className="page-header-content">
          <h1 className="page-title">Batch Import Student Master</h1>
          <p className="page-subtitle">Upload institutional student lists via CSV or Excel (.xlsx) file.</p>
        </div>
        <button onClick={handleDownloadTemplate} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Download size={16} /> Download CSV Template
        </button>
      </div>

      {/* Upload Zone */}
      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleUploadPreview}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                border: '2px dashed var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '32px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface-hover)',
                cursor: 'pointer',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={36} color="var(--color-primary)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600, color: 'var(--color-heading)' }}>
                {file ? file.name : 'Select or drop your CSV or Excel file here'}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Supports .csv, .xlsx, .xls up to 10MB
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              {file && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setFile(null);
                    setPreviewData(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  Clear
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={!file || uploading}>
                {uploading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Analyzing File...
                  </>
                ) : (
                  <>
                    <Upload size={16} /> Preview & Validate
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Commit Result Success Card */}
      {commitResult && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--color-success)', backgroundColor: 'var(--color-success-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle size={28} color="var(--color-success)" />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-heading)', fontSize: '1.0625rem' }}>
                Import Completed Successfully
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>
                Inserted: <strong>{commitResult.insertedCount || commitResult.importedCount || 0}</strong> · Updated: <strong>{commitResult.updatedCount || 0}</strong> · Skipped: <strong>{commitResult.skippedCount || 0}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Section */}
      {previewData && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
            <div>
              <div className="card-title" style={{ margin: 0 }}>Import Validation Summary</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                File: {previewData.filename || file?.name} · Total Rows: {previewData.totalRows || 0}
              </div>
            </div>
            <button
              onClick={handleCommit}
              className="btn btn-success"
              disabled={committing || (previewData.validRows || 0) === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              {committing ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Confirm & Execute Import ({previewData.validRows || 0} records)
            </button>
          </div>

          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ padding: '12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Valid to Import</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)' }}>
                {previewData.validRows || 0}
              </div>
            </div>
            <div style={{ padding: '12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Duplicates / Updates</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-warning)' }}>
                {(previewData.internalDuplicates || 0) + (previewData.conflicts || 0)}
              </div>
            </div>
            <div style={{ padding: '12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Invalid / Errors</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-error)' }}>
                {previewData.invalidRows || 0}
              </div>
            </div>
          </div>

          {/* Sample Rows Table */}
          {previewData.rowResults && previewData.rowResults.length > 0 && (
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface-hover)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '8px 12px' }}>Row</th>
                    <th style={{ padding: '8px 12px' }}>Reg No</th>
                    <th style={{ padding: '8px 12px' }}>Name</th>
                    <th style={{ padding: '8px 12px' }}>College Email</th>
                    <th style={{ padding: '8px 12px' }}>Dept</th>
                    <th style={{ padding: '8px 12px' }}>Year</th>
                    <th style={{ padding: '8px 12px' }}>Academic Year</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.rowResults.slice(0, 20).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>{row.rowNumber || idx + 1}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{row.data?.registerNumber || row.registerNumber || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{row.data?.name || row.name || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{row.data?.collegeEmail || row.collegeEmail || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{row.department || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{row.currentYear || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{row.academicYear || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {row.status === 'valid' ? (
                          <span className="badge badge-success">Valid</span>
                        ) : (
                          <span className="badge badge-error" title={row.errors?.join(', ')}>
                            {row.errors?.[0] || 'Error'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.rowResults.length > 20 && (
                <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  Showing first 20 of {previewData.rowResults.length} records in preview.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Historical Imports */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Clock size={18} color="var(--color-primary)" />
          Recent Import History
        </div>

        {history.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No past imports recorded yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
                  <th style={{ padding: '10px 12px' }}>Filename</th>
                  <th style={{ padding: '10px 12px' }}>Imported On</th>
                  <th style={{ padding: '10px 12px' }}>Total Rows</th>
                  <th style={{ padding: '10px 12px' }}>Inserted</th>
                  <th style={{ padding: '10px 12px' }}>Updated</th>
                  <th style={{ padding: '10px 12px' }}>Errors</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{item.filename}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{formatDate(item.createdAt)}</td>
                    <td style={{ padding: '10px 12px' }}>{item.totalRows}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-success)', fontWeight: 600 }}>{item.insertedCount || item.importedCount || 0}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-warning)' }}>{item.updatedCount || 0}</td>
                    <td style={{ padding: '10px 12px', color: item.errorCount > 0 ? 'var(--color-error)' : 'var(--color-text-muted)' }}>{item.errorCount || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
