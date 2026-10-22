import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Clock, LogOut, XCircle, GraduationCap, RefreshCw } from 'lucide-react';

export default function PendingApprovalPage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    await refreshUser();
    setChecking(false);
    // After refreshUser, AuthContext re-renders; HomeRedirect will route approved students automatically.
    navigate('/');
  };

  const isRejected = user?.verificationStatus === 'rejected';

  // If student account is active / not requiring approval, redirect directly to student portal
  if (user && user.verificationStatus !== 'pending' && user.verificationStatus !== 'rejected') {
    navigate('/student', { replace: true });
    return null;
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div className="auth-logo-icon" style={{ width: 48, height: 48 }}>
            <GraduationCap size={26} color="#fff" />
          </div>
        </div>

        {isRejected ? (
          <>
            <XCircle size={40} color="var(--color-error)" style={{ margin: '0 auto 12px' }} />
            <h2 style={{ marginBottom: 8 }}>Registration Not Approved</h2>
            <p className="auth-subtitle">
              Your account registration was not approved by the scholarship officer.
              {user?.verificationRemarks && (
                <><br /><br /><strong>Reason:</strong> {user.verificationRemarks}</>
              )}
            </p>
            <div className="alert alert-error" style={{ textAlign: 'left', marginTop: 16 }}>
              If you believe this is an error, please contact the scholarship office directly.
            </div>
          </>
        ) : (
          <>
            <Clock size={40} color="var(--color-warning)" style={{ margin: '0 auto 12px' }} />
            <h2 style={{ marginBottom: 8 }}>Account Pending Approval</h2>
            <p className="auth-subtitle">
              Your account has been created and is awaiting review by the scholarship officer.
              You'll receive an email notification once your account is approved.
            </p>
            <div className="alert alert-info" style={{ textAlign: 'left', marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>What happens next?</div>
              <ol style={{ paddingLeft: 16, margin: 0, lineHeight: 1.8, listStyle: 'decimal' }}>
                <li>Scholarship officer reviews your account</li>
                <li>You receive an email notification</li>
                <li>Log in to start applying for scholarships</li>
              </ol>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleCheckStatus}
              disabled={checking}
              style={{ marginTop: 20, width: '100%' }}
            >
              <RefreshCw size={14} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
              {checking ? 'Checking…' : 'Check Approval Status'}
            </button>
          </>
        )}

        <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ marginTop: 12 }}>
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </div>
  );
}
