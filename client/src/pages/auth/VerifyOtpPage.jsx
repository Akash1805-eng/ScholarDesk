import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { GraduationCap, RefreshCw, CheckCircle } from 'lucide-react';
import api from '../../services/api.js';
import { getErrorMessage } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

export default function VerifyOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};

  const { collegeEmail, purpose = 'registration', expiresAt: initialExpiry, expirySeconds = 30 } = state;

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expiresAt, setExpiresAt] = useState(initialExpiry ? new Date(initialExpiry) : null);
  const inputRefs = useRef([]);

  // Countdown timer (uses server expiry time)
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  if (!collegeEmail) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <p>No active OTP session. Please <Link to="/register">start registration again</Link>.</p>
        </div>
      </div>
    );
  }

  const otp = digits.join('');

  const handleDigitChange = (idx, val) => {
    const v = val.replace(/\D/, '').slice(-1);
    const next = [...digits];
    next[idx] = v;
    setDigits(next);
    if (v && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setDigits(text.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) { setError('Please enter the complete 6-digit code.'); return; }
    if (timeLeft === 0) { setError('OTP expired. Please request a new code.'); return; }
    setError('');
    setLoading(true);
    try {
      if (purpose === 'registration') {
        await api.post('/auth/verify-otp', { collegeEmail, otp });
        setSuccess(true);
        toast.success('Your account has been created successfully. You can now log in and apply for scholarships.');
        setTimeout(() => navigate('/login'), 2500);
      } else if (purpose === 'password_reset') {
        const res = await api.post('/auth/verify-reset-otp', { collegeEmail, otp });
        toast.success('OTP verified!');
        navigate('/reset-password', { state: { resetToken: res.data.resetToken, collegeEmail } });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResending(true);
    try {
      const res = await api.post('/auth/resend-otp', { collegeEmail, purpose });
      setExpiresAt(new Date(res.data.expiresAt));
      setDigits(['', '', '', '', '', '']);
      setResendCooldown(30);
      toast.success('New code sent to your college email.');
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <CheckCircle size={48} color="var(--color-success)" style={{ margin: '0 auto 16px' }} />
          <h2>Account Created!</h2>
          <p className="auth-subtitle">
            Your account has been created successfully. You can now log in and apply for scholarships.
          </p>
          <Link to="/login" className="btn btn-primary btn-full" style={{ marginTop: 16 }}>Go to Login</Link>
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
        <h1 className="auth-title">Verify your email</h1>
        <p className="auth-subtitle">
          Enter the 6-digit code sent to <strong>{collegeEmail}</strong>.
          {' '}The code is valid for a short time.
        </p>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="otp-input" onPaste={handlePaste} aria-label="OTP input">
            {digits.map((d, idx) => (
              <input
                key={idx}
                ref={el => inputRefs.current[idx] = el}
                type="text"
                inputMode="numeric"
                className="otp-digit"
                maxLength={1}
                value={d}
                onChange={e => handleDigitChange(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                aria-label={`Digit ${idx + 1}`}
                autoFocus={idx === 0}
              />
            ))}
          </div>

          <div className={`otp-timer${timeLeft === 0 ? ' expired' : ''}`} aria-live="polite">
            {timeLeft > 0
              ? `Code expires in ${timeLeft}s`
              : 'Code has expired — request a new one'}
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg" style={{ marginTop: 16 }} disabled={loading || timeLeft === 0}>
            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Verifying…</> : 'Verify Code'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleResend}
            disabled={resending || resendCooldown > 0}
          >
            <RefreshCw size={14} />
            {resending ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
          </button>
        </div>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          {purpose === 'registration'
            ? <><Link to="/register">← Back to registration</Link></>
            : <><Link to="/forgot-password">← Try a different email</Link></>}
        </p>
      </div>
    </div>
  );
}
