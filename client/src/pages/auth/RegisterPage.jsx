import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Hash, Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import api from '../../services/api.js';
import { getErrorMessage } from '../../utils/helpers.js';

const COLLEGE_EMAIL_DOMAIN = 'eec.srmrmp.edu.in';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ registerNumber: '', password: '', confirmPassword: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Auto-generate college email based on register number
  const generatedEmail = useMemo(() => {
    const reg = form.registerNumber.trim();
    return reg ? `${reg}@${COLLEGE_EMAIL_DOMAIN}` : '';
  }, [form.registerNumber]);

  const handleRegisterNumberChange = (e) => {
    // Keep register number as a string, filter to digits, max 12 digits
    const rawVal = e.target.value.replace(/\D/g, '').slice(0, 12);
    setForm(prev => ({ ...prev, registerNumber: rawVal }));
    if (fieldErrors.registerNumber) {
      setFieldErrors(prev => ({ ...prev, registerNumber: '' }));
    }
  };

  const validate = () => {
    const errs = {};
    const regNum = form.registerNumber.trim();
    if (!regNum) {
      errs.registerNumber = 'Register number is required.';
    } else if (!/^\d{12}$/.test(regNum)) {
      errs.registerNumber = `Use your college email in the format 310624104001@${COLLEGE_EMAIL_DOMAIN}.`;
    }

    if (!form.password) {
      errs.password = 'Password is required.';
    } else if (form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }

    if (!form.confirmPassword) {
      errs.confirmPassword = 'Confirm password is required.';
    } else if (form.password !== form.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        registerNumber: form.registerNumber.trim(),
        collegeEmail: generatedEmail,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });

      navigate('/verify-otp', {
        state: {
          collegeEmail: res.data.collegeEmail || generatedEmail,
          purpose: 'registration',
          expiresAt: res.data.expiresAt,
          expirySeconds: res.data.expirySeconds || 30,
        },
      });
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const F = ({ field }) => fieldErrors[field] ? (
    <span className="form-error" role="alert">{fieldErrors[field]}</span>
  ) : null;

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo">
          <div className="auth-logo-icon"><GraduationCap size={22} color="#fff" /></div>
          <span className="auth-logo-text">Scholarship Desk</span>
        </div>

        <h1 className="auth-title">Create your student account</h1>
        <p className="auth-subtitle">Enter your 12-digit register number to verify your college record.</p>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="regnum">12-Digit Register Number</label>
            <div style={{ position: 'relative' }}>
              <Hash size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                id="regnum"
                type="text"
                inputMode="numeric"
                maxLength={12}
                className={`form-input${fieldErrors.registerNumber ? ' error' : ''}`}
                style={{ paddingLeft: 36 }}
                placeholder="e.g. 310624104001"
                value={form.registerNumber}
                onChange={handleRegisterNumberChange}
                autoComplete="off"
              />
            </div>
            <F field="registerNumber" />
            <span className="form-hint">Enter your 12-digit institutional register number.</span>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" htmlFor="cemail" style={{ margin: 0 }}>College Email</label>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 500 }}>
                <ShieldCheck size={13} /> Auto-generated
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                id="cemail"
                type="email"
                readOnly
                className="form-input"
                style={{
                  paddingLeft: 36,
                  backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                  cursor: 'not-allowed',
                  color: form.registerNumber ? 'var(--color-text)' : 'var(--color-text-muted)',
                }}
                placeholder={`310624104001@${COLLEGE_EMAIL_DOMAIN}`}
                value={generatedEmail}
                tabIndex={-1}
              />
            </div>
            <span className="form-hint">Format: &lt;register-number&gt;@{COLLEGE_EMAIL_DOMAIN}</span>
          </div>

          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="pwd">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                id="pwd"
                type={showPwd ? 'text' : 'password'}
                className={`form-input${fieldErrors.password ? ' error' : ''}`}
                style={{ paddingLeft: 36, paddingRight: 40 }}
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                aria-label="Toggle password visibility"
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <F field="password" />
          </div>

          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="cpwd">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                id="cpwd"
                type={showConfirmPwd ? 'text' : 'password'}
                className={`form-input${fieldErrors.confirmPassword ? ' error' : ''}`}
                style={{ paddingLeft: 36, paddingRight: 40 }}
                placeholder="Re-enter password"
                value={form.confirmPassword}
                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd(s => !s)}
                aria-label="Toggle confirm password visibility"
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
              >
                {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <F field="confirmPassword" />
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Sending OTP…</> : 'Continue — Send OTP'}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
