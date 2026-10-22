import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api.js';
import { getErrorMessage } from '../../utils/helpers.js';
import toast from 'react-hot-toast';
import { Award, Plus, Trash2, ChevronLeft, Save } from 'lucide-react';

const CRITERIA_FIELDS = [
  { value: 'department', label: 'Department (CSE, IT, etc.)', type: 'string' },
  { value: 'currentYear', label: 'Current Year (1, 2, 3, 4)', type: 'number' },
  { value: 'category', label: 'Category (General, OBC, SC, ST, etc.)', type: 'string' },
  { value: 'religion', label: 'Religion (Hindu, Muslim, Christian, etc.)', type: 'string' },
  { value: 'annualIncome', label: 'Annual Income (₹ max/min limit)', type: 'number' },
  { value: 'currentCgpa', label: 'Current CGPA (min threshold)', type: 'number' },
  { value: 'marks10th', label: '10th Percentage (min)', type: 'number' },
  { value: 'marks12th', label: '12th Percentage (min)', type: 'number' },
];

const OPERATORS = [
  { value: 'eq', label: 'Equals (==)' },
  { value: 'neq', label: 'Not Equals (!=)' },
  { value: 'gte', label: 'Greater Than or Equal (>=)' },
  { value: 'lte', label: 'Less Than or Equal (<=)' },
  { value: 'gt', label: 'Greater Than (>)' },
  { value: 'lt', label: 'Less Than (<)' },
  { value: 'in', label: 'One of (comma-separated list)' },
  { value: 'nin', label: 'Not in list' },
];

const AVAILABLE_DOC_TYPES = [
  { value: 'income_certificate', label: 'Income Certificate' },
  { value: 'community_certificate', label: 'Community / Caste Certificate' },
  { value: 'marksheet_10th', label: '10th Marksheet' },
  { value: 'marksheet_12th', label: '12th Marksheet' },
  { value: 'current_semester_marksheet', label: 'Current Semester Marksheet / CGPA' },
  { value: 'fee_receipt', label: 'College Tuition Fee Receipt' },
  { value: 'bank_passbook', label: 'Bank Passbook / Cancelled Cheque' },
  { value: 'aadhaar_card', label: 'Aadhaar Card' },
];

export default function ScholarshipFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [deadline, setDeadline] = useState('');
  const [awardAmount, setAwardAmount] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Lists
  const [eligibilityCriteria, setEligibilityCriteria] = useState([]);
  const [requiredDocuments, setRequiredDocuments] = useState([]);
  const [customQuestions, setCustomQuestions] = useState([]);

  useEffect(() => {
    if (isEdit) {
      api.get(`/scholarships/${id}`)
        .then((res) => {
          const s = res.data.scholarship;
          setTitle(s.title || '');
          setDescription(s.description || '');
          setAcademicYear(s.academicYear || '2026-2027');
          setDeadline(s.deadline ? s.deadline.split('T')[0] : '');
          setAwardAmount(s.awardAmount != null ? s.awardAmount : '');
          setIsActive(s.isActive !== false);
          setEligibilityCriteria(s.eligibilityCriteria || []);
          setRequiredDocuments(s.requiredDocuments || []);
          setCustomQuestions(s.customQuestions || []);
        })
        .catch((err) => {
          toast.error(getErrorMessage(err));
          navigate('/admin/scholarships');
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  // Criteria handlers
  const addCriterion = () => {
    setEligibilityCriteria((prev) => [
      ...prev,
      { field: 'annualIncome', operator: 'lte', value: '' },
    ]);
  };

  const updateCriterion = (index, key, val) => {
    setEligibilityCriteria((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: val };
      return copy;
    });
  };

  const removeCriterion = (index) => {
    setEligibilityCriteria((prev) => prev.filter((_, i) => i !== index));
  };

  // Doc types toggle
  const toggleDocType = (docType) => {
    setRequiredDocuments((prev) =>
      prev.includes(docType) ? prev.filter((d) => d !== docType) : [...prev, docType]
    );
  };

  // Custom question handlers
  const addQuestion = () => {
    const qid = `q_${Date.now()}`;
    setCustomQuestions((prev) => [
      ...prev,
      { questionId: qid, questionText: '', questionType: 'text', isRequired: false },
    ]);
  };

  const updateQuestion = (index, key, val) => {
    setCustomQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: val };
      return copy;
    });
  };

  const removeQuestion = (index) => {
    setCustomQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Scholarship title is required.');
      return;
    }
    if (!deadline) {
      toast.error('Please set an application deadline.');
      return;
    }

    setSaving(true);
    try {
      // Process criteria values
      const processedCriteria = eligibilityCriteria.map((c) => {
        let val = c.value;
        const fieldMeta = CRITERIA_FIELDS.find((f) => f.value === c.field);
        if (c.operator === 'in' || c.operator === 'nin') {
          val = typeof val === 'string' ? val.split(',').map((s) => s.trim()) : val;
        } else if (fieldMeta?.type === 'number') {
          val = Number(val);
        }
        return { field: c.field, operator: c.operator, value: val };
      });

      const payload = {
        title: title.trim(),
        description: description.trim(),
        academicYear: academicYear.trim(),
        deadline: new Date(deadline).toISOString(),
        awardAmount: awardAmount ? Number(awardAmount) : null,
        isActive,
        eligibilityCriteria: processedCriteria,
        requiredDocuments,
        customQuestions,
      };

      if (isEdit) {
        await api.put(`/scholarships/${id}`, payload);
        toast.success('Scholarship updated successfully!');
      } else {
        await api.post('/scholarships', payload);
        toast.success('Scholarship scheme created successfully!');
      }
      navigate('/admin/scholarships');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link to="/admin/scholarships" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ChevronLeft size={16} /> Back to Scholarships
        </Link>
      </div>

      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-header-content">
          <h1 className="page-title">{isEdit ? 'Edit Scholarship Scheme' : 'Create Scholarship Scheme'}</h1>
          <p className="page-subtitle">Configure scheme rules, dynamic eligibility conditions, and required evidence.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Core Details */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Basic Scheme Information</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="scholarship-title">Scholarship Scheme Title *</label>
              <input
                id="scholarship-title"
                type="text"
                className="form-input"
                required
                placeholder="e.g. Merit-Cum-Means Engineering Scholarship"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="scholarship-desc">Scheme Description & Objectives</label>
              <textarea
                id="scholarship-desc"
                className="form-input"
                rows={3}
                placeholder="Provide overview of the scholarship, target audience, and benefits..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="scholarship-ay">Academic Year *</label>
                <input
                  id="scholarship-ay"
                  type="text"
                  className="form-input"
                  required
                  placeholder="2026-2027"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="scholarship-deadline">Application Deadline *</label>
                <input
                  id="scholarship-deadline"
                  type="date"
                  className="form-input"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="scholarship-award">Award Amount (₹)</label>
                <input
                  id="scholarship-award"
                  type="number"
                  className="form-input"
                  placeholder="e.g. 50000 (leave blank for variable)"
                  value={awardAmount}
                  onChange={(e) => setAwardAmount(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label className="form-label" style={{ marginBottom: 8 }}>Scheme Status</label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span>Active & Accepting Applications</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Eligibility Criteria Builder */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div className="card-title" style={{ margin: 0 }}>Automated Eligibility Rules</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Evaluated deterministically against student official records and profile fields before allowing form submission.
              </div>
            </div>
            <button type="button" onClick={addCriterion} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Add Criterion
            </button>
          </div>

          {eligibilityCriteria.length === 0 ? (
            <div style={{ padding: '16px', borderRadius: 'var(--radius)', backgroundColor: 'var(--color-surface-hover)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              No specific eligibility criteria configured. All registered active students will be eligible.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {eligibilityCriteria.map((criterion, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    padding: '12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'var(--color-surface-hover)',
                  }}
                >
                  <div style={{ flex: '1 1 200px' }}>
                    <select
                      className="form-input"
                      value={criterion.field}
                      onChange={(e) => updateCriterion(idx, 'field', e.target.value)}
                    >
                      {CRITERIA_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: '0 1 180px' }}>
                    <select
                      className="form-input"
                      value={criterion.operator}
                      onChange={(e) => updateCriterion(idx, 'operator', e.target.value)}
                    >
                      {OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: '1 1 160px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Comparison value..."
                      value={Array.isArray(criterion.value) ? criterion.value.join(', ') : criterion.value}
                      onChange={(e) => updateCriterion(idx, 'value', e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeCriterion(idx)}
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--color-error)' }}
                    title="Remove rule"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Required Documents Selector */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>Required Document Evidence</div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Select the certificates and documents that students must have uploaded in their repository to apply.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {AVAILABLE_DOC_TYPES.map((dt) => {
              const checked = requiredDocuments.includes(dt.value);
              return (
                <label
                  key={dt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    border: '1px solid',
                    borderColor: checked ? 'var(--color-primary)' : 'var(--color-border)',
                    borderRadius: 'var(--radius)',
                    backgroundColor: checked ? 'var(--color-primary-light)' : 'var(--color-surface)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDocType(dt.value)}
                  />
                  <span style={{ fontWeight: checked ? 600 : 400 }}>{dt.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Custom Questionnaire */}
        <div className="card" style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div className="card-title" style={{ margin: 0 }}>Scheme-Specific Questions</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Additional questions required specifically for this scholarship scheme.
              </div>
            </div>
            <button type="button" onClick={addQuestion} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Add Question
            </button>
          </div>

          {customQuestions.length === 0 ? (
            <div style={{ padding: '16px', borderRadius: 'var(--radius)', backgroundColor: 'var(--color-surface-hover)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              No custom questions configured.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {customQuestions.map((q, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    padding: '12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'var(--color-surface-hover)',
                  }}
                >
                  <div style={{ flex: '2 1 240px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Question text..."
                      value={q.questionText}
                      onChange={(e) => updateQuestion(idx, 'questionText', e.target.value)}
                    />
                  </div>

                  <div style={{ flex: '1 1 120px' }}>
                    <select
                      className="form-input"
                      value={q.questionType}
                      onChange={(e) => updateQuestion(idx, 'questionType', e.target.value)}
                    >
                      <option value="text">Short Text</option>
                      <option value="number">Number</option>
                      <option value="boolean">Yes / No</option>
                    </select>
                  </div>

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={q.isRequired}
                      onChange={(e) => updateQuestion(idx, 'isRequired', e.target.checked)}
                    />
                    <span>Required</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--color-error)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Link to="/admin/scholarships" className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : isEdit ? 'Update Scholarship Scheme' : 'Publish Scholarship Scheme'}
          </button>
        </div>
      </form>
    </div>
  );
}
