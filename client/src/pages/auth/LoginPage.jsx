import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { GraduationCap, ClipboardCheck, ShieldCheck, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { getErrorMessage } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
  { value: 'student',  label: 'Student',  Icon: GraduationCap },
  { value: 'verifier', label: 'Verifier', Icon: ClipboardCheck },
  { value: 'admin',    label: 'Admin',    Icon: ShieldCheck },
];

const ROLE_PLACEHOLDERS = {
  student: 'College email or register number',
  verifier: 'verifier@eec.srmrmp.edu.in',
  admin: 'admin@eec.srmrmp.edu.in',
};

export default function LoginPage() {
  const { login, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ collegeEmail: '', password: '' });
  const [selectedRole, setSelectedRole] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roleError, setRoleError] = useState('');

  // If already authenticated, redirect directly to role dashboard
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'admin') navigate('/admin', { replace: true });
      else if (currentUser.role === 'verifier') navigate('/verifier', { replace: true });
      else navigate('/student', { replace: true });
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setError('');
    setRoleError('');

    if (!selectedRole) {
      setRoleError('Please select your role to continue.');
      return;
    }

    const emailOrId = (form.collegeEmail || '').trim();
    if (!emailOrId) {
      setError('Please enter your college email or register number.');
      return;
    }

    if (!form.password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const user = await login({
        identifier: emailOrId,
        collegeEmail: emailOrId,
        password: form.password,
        selectedRole,
      });
      toast.success('Welcome back!');
      // Route by authenticated role from server
      if (user?.role === 'admin') navigate('/admin', { replace: true });
      else if (user?.role === 'verifier') navigate('/verifier', { replace: true });
      else navigate('/student', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <GraduationCap size={22} color="#fff" />
          </div>
          <span className="auth-logo-text">Scholarship Desk</span>
        </div>

        <h1 className="auth-title">Sign in to your account</h1>
        <p className="auth-subtitle">Use your college email and password.</p>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Role selector */}
          <div className="form-group">
            <label className="form-label form-label-required" id="role-selector-label">Select Your Role</label>
            <div className="role-selector" role="radiogroup" aria-labelledby="role-selector-label">
              {ROLE_OPTIONS.map(({ value, label, Icon }) => {
                const isSelected = selectedRole === value;
                return (
                  <button
                    key={value}
                    type="button"
                    id={`role-btn-${value}`}
                    className={`role-selector-btn${isSelected ? ' role-selector-btn--selected' : ''}`}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected || (!selectedRole && value === 'student') ? 0 : -1}
                    onClick={() => { setSelectedRole(value); setRoleError(''); }}
                    onKeyDown={(e) => {
                      const idx = ROLE_OPTIONS.findIndex(r => r.value === value);
                      let nextIdx = -1;
                      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                        nextIdx = (idx + 1) % ROLE_OPTIONS.length;
                      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                        nextIdx = (idx - 1 + ROLE_OPTIONS.length) % ROLE_OPTIONS.length;
                      }
                      if (nextIdx >= 0) {
                        e.preventDefault();
                        const nextValue = ROLE_OPTIONS[nextIdx].value;
                        setSelectedRole(nextValue);
                        setRoleError('');
                        document.getElementById(`role-btn-${nextValue}`)?.focus();
                      }
                    }}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            {roleError && <span className="form-error" role="alert">{roleError}</span>}
          </div>

          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="email">College Email or Register Number</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                id="email"
                type="text"
                className="form-input"
                style={{ paddingLeft: 36 }}
                placeholder={ROLE_PLACEHOLDERS[selectedRole] || 'College email or register number'}
                value={form.collegeEmail}
                onChange={e => setForm({ ...form, collegeEmail: e.target.value })}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                className="form-input"
                style={{ paddingLeft: 36, paddingRight: 40 }}
                placeholder="Your password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 16 }}>
            <Link to="/forgot-password" style={{ fontSize: '0.875rem' }}>Forgot password?</Link>
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Signing in…</> : 'Sign in'}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          New student?{' '}
          <Link to="/register">Create your account</Link>
        </p>
      </div>
    </div>
  );
}
