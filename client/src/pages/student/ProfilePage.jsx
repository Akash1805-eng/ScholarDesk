import { useState, useEffect } from 'react';
import api from '../../services/api.js';
import { getErrorMessage } from '../../utils/helpers.js';
import toast from 'react-hot-toast';
import { Save, Lock } from 'lucide-react';

const CATEGORY_OPTIONS = ['OC', 'BC', 'BC(M)', 'MBC', 'SC', 'ST', 'SCA', 'OBC'];
const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];

export default function ProfilePage() {
  const [official, setOfficial] = useState(null);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api.get('/students/profile').then(res => {
      setOfficial(res.data.official);
      setProfile(res.data.profile);
      const p = res.data.profile || {};
      setForm({
        cgpa: p.cgpa ?? '',
        percentage: p.percentage ?? '',
        familyIncome: p.familyIncome ?? '',
        category: p.category ?? '',
        gender: p.gender ?? '',
        isFirstGraduate: p.isFirstGraduate ?? false,
        hasDisability: p.hasDisability ?? false,
        disabilityDetails: p.disabilityDetails ?? '',
        phone: p.phone ?? '',
        address_line1: p.address?.line1 ?? '',
        address_city: p.address?.city ?? '',
        address_state: p.address?.state ?? '',
        address_pincode: p.address?.pincode ?? '',
        bank_accountNumber: p.bankDetails?.accountNumber ?? '',
        bank_ifscCode: p.bankDetails?.ifscCode ?? '',
        bank_bankName: p.bankDetails?.bankName ?? '',
        bank_holderName: p.bankDetails?.accountHolderName ?? '',
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleChange = (field, val) => {
    setForm(f => ({ ...f, [field]: val }));
    setDirty(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        cgpa: form.cgpa !== '' ? Number(form.cgpa) : undefined,
        percentage: form.percentage !== '' ? Number(form.percentage) : undefined,
        familyIncome: form.familyIncome !== '' ? Number(form.familyIncome) : undefined,
        category: form.category || undefined,
        gender: form.gender || undefined,
        isFirstGraduate: form.isFirstGraduate,
        hasDisability: form.hasDisability,
        disabilityDetails: form.disabilityDetails || undefined,
        phone: form.phone || undefined,
        address: {
          line1: form.address_line1,
          city: form.address_city,
          state: form.address_state,
          pincode: form.address_pincode,
        },
        bankDetails: {
          accountNumber: form.bank_accountNumber,
          ifscCode: form.bank_ifscCode,
          bankName: form.bank_bankName,
          accountHolderName: form.bank_holderName,
        },
      };
      const res = await api.put('/students/profile', payload);
      setProfile(res.data.profile);
      setDirty(false);
      toast.success('Profile saved successfully.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Official details are imported from the institution. Editable fields can be updated anytime.</p>
        </div>
        {dirty && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSave}>
        {/* Official Details (read-only) */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title">Official Record</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              <Lock size={12} />
              Read-only — imported from institution
            </div>
          </div>
          <div className="form-grid">
            {[
              { label: 'Full Name', val: official?.name },
              { label: 'Register Number', val: official?.registerNumber },
              { label: 'College Email', val: official?.collegeEmail },
              { label: 'Department', val: official?.department },
              { label: 'Current Year', val: official?.currentYear ? `Year ${official.currentYear}` : '—' },
              { label: 'Academic Year', val: official?.academicYear },
            ].map(({ label, val }) => (
              <div className="form-group" key={label}>
                <label className="form-label">{label}</label>
                <input className="form-input" value={val || '—'} readOnly />
              </div>
            ))}
          </div>
        </div>

        {/* Academic Details */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Academic Details</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="cgpa">CGPA</label>
              <input id="cgpa" type="number" step="0.01" min="0" max="10" className="form-input"
                placeholder="e.g. 8.50" value={form.cgpa}
                onChange={e => handleChange('cgpa', e.target.value)} />
              <span className="form-hint">Your current cumulative GPA out of 10.</span>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="percentage">Percentage</label>
              <input id="percentage" type="number" step="0.01" min="0" max="100" className="form-input"
                placeholder="e.g. 85.00" value={form.percentage}
                onChange={e => handleChange('percentage', e.target.value)} />
              <span className="form-hint">For scholarship schemes requiring percentage.</span>
            </div>
          </div>
        </div>

        {/* Personal & Eligibility */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Personal & Eligibility Details</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="income">Annual Family Income (₹)</label>
              <input id="income" type="number" min="0" className="form-input"
                placeholder="e.g. 250000" value={form.familyIncome}
                onChange={e => handleChange('familyIncome', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="category">Category</label>
              <select id="category" className="form-select" value={form.category}
                onChange={e => handleChange('category', e.target.value)}>
                <option value="">Select category</option>
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="gender">Gender</label>
              <select id="gender" className="form-select" value={form.gender}
                onChange={e => handleChange('gender', e.target.value)}>
                <option value="">Select gender</option>
                {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="phone">Phone Number</label>
              <input id="phone" type="tel" className="form-input" placeholder="e.g. 9876543210"
                value={form.phone} onChange={e => handleChange('phone', e.target.value)} />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: 8 }}>
            <label className="checkbox-group">
              <input type="checkbox" checked={form.isFirstGraduate}
                onChange={e => handleChange('isFirstGraduate', e.target.checked)} />
              First graduate in my family
            </label>
            <label className="checkbox-group">
              <input type="checkbox" checked={form.hasDisability}
                onChange={e => handleChange('hasDisability', e.target.checked)} />
              Person with disability
            </label>
          </div>
          {form.hasDisability && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label" htmlFor="disability">Disability Details</label>
              <textarea id="disability" className="form-textarea" style={{ minHeight: 64 }}
                placeholder="Briefly describe the type and extent of disability."
                value={form.disabilityDetails} onChange={e => handleChange('disabilityDetails', e.target.value)} />
            </div>
          )}
        </div>

        {/* Address */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Home Address</div>
          <div className="form-group">
            <label className="form-label" htmlFor="addr_line1">Address Line 1</label>
            <input id="addr_line1" type="text" className="form-input" placeholder="House no, Street"
              value={form.address_line1} onChange={e => handleChange('address_line1', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="addr_city">City</label>
              <input id="addr_city" type="text" className="form-input" placeholder="City"
                value={form.address_city} onChange={e => handleChange('address_city', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="addr_state">State</label>
              <input id="addr_state" type="text" className="form-input" placeholder="State"
                value={form.address_state} onChange={e => handleChange('address_state', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="addr_pin">Pincode</label>
              <input id="addr_pin" type="text" className="form-input" maxLength={6} placeholder="600001"
                value={form.address_pincode} onChange={e => handleChange('address_pincode', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Bank Details</div>
          <div className="alert alert-info" style={{ marginBottom: 12 }}>
            Bank details are required for scholarship disbursement. Ensure accuracy.
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="bank_acc">Account Number</label>
              <input id="bank_acc" type="text" className="form-input" placeholder="Account number"
                value={form.bank_accountNumber} onChange={e => handleChange('bank_accountNumber', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="bank_ifsc">IFSC Code</label>
              <input id="bank_ifsc" type="text" className="form-input" placeholder="e.g. SBIN0001234"
                value={form.bank_ifscCode} onChange={e => handleChange('bank_ifscCode', e.target.value.toUpperCase())} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="bank_name">Bank Name</label>
              <input id="bank_name" type="text" className="form-input" placeholder="Bank name"
                value={form.bank_bankName} onChange={e => handleChange('bank_bankName', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="bank_holder">Account Holder Name</label>
              <input id="bank_holder" type="text" className="form-input" placeholder="As per bank records"
                value={form.bank_holderName} onChange={e => handleChange('bank_holderName', e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving || !dirty}>
            <Save size={16} />
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
