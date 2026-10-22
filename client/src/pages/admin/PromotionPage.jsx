import { useState } from 'react';
import api from '../../services/api.js';
import { getErrorMessage } from '../../utils/helpers.js';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowRight, CheckCircle, RefreshCw, Users, ShieldAlert } from 'lucide-react';

export default function PromotionPage() {
  const [fromYear, setFromYear] = useState('1');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState(null);

  const handlePreview = async (e) => {
    e.preventDefault();
    setPreviewing(true);
    setPreviewResult(null);
    setExecuteResult(null);

    try {
      const res = await api.post('/admin/students/promote', {
        fromYear: parseInt(fromYear),
        academicYear: academicYear.trim(),
        confirm: false,
      });
      setPreviewResult(res.data);
      if (res.data.count === 0) {
        toast('No active students found in this cohort.', { icon: 'ℹ️' });
      } else {
        toast.success(`Found ${res.data.count} student(s) eligible for promotion.`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPreviewing(false);
    }
  };

  const handleExecutePromotion = async () => {
    if (!previewResult) return;
    setExecuting(true);
    try {
      const res = await api.post('/admin/students/promote', {
        fromYear: parseInt(fromYear),
        academicYear: academicYear.trim(),
        confirm: true,
      });
      setExecuteResult(res.data);
      setPreviewResult(null);
      toast.success(`Successfully promoted ${res.data.promotedCount} students!`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Academic Year-End Promotion</h1>
          <p className="page-subtitle">Batch promote student cohorts into their next academic year or graduate 4th year seniors.</p>
        </div>
      </div>

      {/* Warning Card */}
      <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--color-warning)', backgroundColor: 'var(--color-warning-bg)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertTriangle size={24} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-heading)', fontSize: '0.9375rem' }}>
              Important Operational Note
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text)', marginTop: 4 }}>
              Promotion updates the official institutional record for each active student in the selected cohort. Year 4 students will be transitioned to 'graduated' status. All operations are logged to the student's historical audit record.
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Select Cohort to Advance</div>
        <form onSubmit={handlePreview}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, alignItems: 'flex-end' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="from-year">Promote From Year *</label>
              <select
                id="from-year"
                className="form-input"
                value={fromYear}
                onChange={(e) => {
                  setFromYear(e.target.value);
                  setPreviewResult(null);
                  setExecuteResult(null);
                }}
              >
                <option value="1">1st Year → 2nd Year</option>
                <option value="2">2nd Year → 3rd Year</option>
                <option value="3">3rd Year → 4th Year</option>
                <option value="4">4th Year → Graduated</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="academic-year">Active Academic Year *</label>
              <input
                id="academic-year"
                type="text"
                className="form-input"
                required
                placeholder="2026-2027"
                value={academicYear}
                onChange={(e) => {
                  setAcademicYear(e.target.value);
                  setPreviewResult(null);
                  setExecuteResult(null);
                }}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={previewing} style={{ height: 40 }}>
              {previewing ? <RefreshCw size={16} className="animate-spin" /> : <Users size={16} />}
              Preview Cohort
            </button>
          </div>
        </form>
      </div>

      {/* Success Result */}
      {executeResult && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--color-success)', backgroundColor: 'var(--color-success-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle size={28} color="var(--color-success)" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.0625rem', color: 'var(--color-heading)' }}>
                Cohort Promotion Executed
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text)', marginTop: 2 }}>
                Successfully advanced <strong>{executeResult.promotedCount}</strong> students from Year {executeResult.fromYear} to <strong>{executeResult.toYear}</strong> for {executeResult.academicYear}.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Confirmation Panel */}
      {previewResult && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
            <div>
              <div className="card-title" style={{ margin: 0 }}>Promotion Impact Preview</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Target: {previewResult.count} active students will advance from Year {previewResult.fromYear} to <strong>{previewResult.toYear}</strong>
              </div>
            </div>

            {previewResult.count > 0 && (
              <button
                onClick={handleExecutePromotion}
                className="btn btn-danger"
                disabled={executing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {executing ? <RefreshCw size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                Confirm & Execute Promotion ({previewResult.count} students)
              </button>
            )}
          </div>

          {previewResult.count === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              No students match the criteria for promotion.
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text-muted)' }}>
                Sample Affected Records (first {previewResult.sample?.length || 0}):
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-surface-hover)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 12px' }}>Register Number</th>
                      <th style={{ padding: '8px 12px' }}>Student Name</th>
                      <th style={{ padding: '8px 12px' }}>Current Year</th>
                      <th style={{ padding: '8px 12px' }}>New Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.sample?.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{s.registerNumber}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{s.name}</td>
                        <td style={{ padding: '8px 12px' }}>Year {previewResult.fromYear}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                          {previewResult.toYear === 'graduated' ? 'Graduated' : `Year ${previewResult.toYear}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
