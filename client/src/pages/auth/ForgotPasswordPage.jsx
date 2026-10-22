import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Mail } from 'lucide-react';
import api from '../../services/api.js';
import { getErrorMessage } from '../../utils/helpers.js';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { collegeEmail: email.trim() });
      setSent(true);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg || 'OTP could not be sent. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📬</div>
          <h2>Check your email</h2>
          <p className="auth-subtitle">
            If an eligible account exists for <strong>{email}</strong>, a 6-digit code has been sent to its college email.
          </p>
          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: 20 }}
            onClick={() => navigate('/verify-otp', {
              state: { collegeEmail: email, purpose: 'password_reset', expirySeconds: 30 }
            })}
          >
            Enter the code
          </button>
          <p style={{ marginTop: 12, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            <Link to="/login">← Back to login</Link>
          </p>
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
        <h1 className="auth-title">Reset your password</h1>
        <p className="auth-subtitle">Enter your college email. If your account is eligible, we'll send a verification code.</p>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="email">College Email or Register Number</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input id="email" type="text" className="form-input" style={{ paddingLeft: 36 }}
                placeholder="310624104001@eec.srmrmp.edu.in" value={email}
                onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Sending…</> : 'Send reset code'}
          </button>
        </form>
        <p style={{ marginTop: 20, textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          <Link to="/login">← Back to login</Link>
        </p>
      </div>
    </div>
  );
}
