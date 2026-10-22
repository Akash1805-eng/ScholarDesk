import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { GraduationCap, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import api from '../../services/api.js';
import { getErrorMessage } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resetToken } = location.state || {};

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!resetToken) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <p>Invalid or missing reset token. Please <Link to="/forgot-password">start the reset process again</Link>.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.newPassword !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { resetToken, newPassword: form.newPassword, confirmPassword: form.confirmPassword });
      setSuccess(true);
      toast.success('Password changed successfully!');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <CheckCircle size={48} color="var(--color-success)" style={{ margin: '0 auto 16px' }} />
          <h2>Password Changed</h2>
          <p className="auth-subtitle">Your password has been updated. Redirecting to login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><GraduationCap size={22} color="#fff" /></div>
          <span className="auth-logo-text">Scholarship Desk</span>
        </div>
        <h1 className="auth-title">Set a new password</h1>
        <p className="auth-subtitle">Choose a strong password of at least 8 characters.</p>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="newpwd">New Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input id="newpwd" type={showPwd ? 'text' : 'password'} className="form-input" style={{ paddingLeft: 36, paddingRight: 40 }}
                placeholder="Minimum 8 characters" value={form.newPassword}
                onChange={e => setForm({ ...form, newPassword: e.target.value })} autoComplete="new-password" />
              <button type="button" onClick={() => setShowPwd(s => !s)} aria-label="Toggle visibility"
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="cpwd">Confirm Password</label>
            <input id="cpwd" type="password" className="form-input" placeholder="Re-enter new password"
              value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} autoComplete="new-password" />
          </div>
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving…</> : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
