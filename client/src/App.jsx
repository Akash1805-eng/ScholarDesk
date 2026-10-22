import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

// Auth pages
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import VerifyOtpPage from './pages/auth/VerifyOtpPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';

// Student pages
import StudentDashboard from './pages/student/StudentDashboard.jsx';
import ProfilePage from './pages/student/ProfilePage.jsx';
import DocumentsPage from './pages/student/DocumentsPage.jsx';
import ScholarshipsPage from './pages/student/ScholarshipsPage.jsx';
import ApplicationReviewPage from './pages/student/ApplicationReviewPage.jsx';
import MyApplicationsPage from './pages/student/MyApplicationsPage.jsx';
import ApplicationDetailPage from './pages/student/ApplicationDetailPage.jsx';
import NotificationsPage from './pages/student/NotificationsPage.jsx';
import PendingApprovalPage from './pages/auth/PendingApprovalPage.jsx';

// Verifier pages
import VerifierDashboard from './pages/verifier/VerifierDashboard.jsx';
import RegistrationQueuePage from './pages/verifier/RegistrationQueuePage.jsx';
import ApplicationQueuePage from './pages/verifier/ApplicationQueuePage.jsx';
import ApplicationReviewAdminPage from './pages/verifier/ApplicationReviewAdminPage.jsx';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import StudentImportPage from './pages/admin/StudentImportPage.jsx';
import StudentMasterPage from './pages/admin/StudentMasterPage.jsx';
import VerifierManagementPage from './pages/admin/VerifierManagementPage.jsx';
import ScholarshipManagementPage from './pages/admin/ScholarshipManagementPage.jsx';
import ScholarshipFormPage from './pages/admin/ScholarshipFormPage.jsx';
import AdminApplicationsPage from './pages/admin/AdminApplicationsPage.jsx';
import PromotionPage from './pages/admin/PromotionPage.jsx';
import ReportsPage from './pages/admin/ReportsPage.jsx';

// Layouts
import StudentLayout from './layouts/StudentLayout.jsx';
import VerifierLayout from './layouts/VerifierLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';

// Loading screen
function LoadingScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );
}

// Protected route component
function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

// Role-based home redirect
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'verifier') return <Navigate to="/verifier" replace />;
  if (user.role === 'student' && (user.verificationStatus === 'pending' || user.verificationStatus === 'rejected')) {
    return <Navigate to="/pending-approval" replace />;
  }
  return <Navigate to="/student" replace />;
}

export default function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Routes>
        {/* Root and Dashboard redirect */}
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/dashboard" element={<HomeRedirect />} />

        {/* Auth routes (public) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-otp" element={<VerifyOtpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/pending-approval" element={<ProtectedRoute roles={['student']}><PendingApprovalPage /></ProtectedRoute>} />

        {/* Student routes */}
        <Route path="/student" element={<ProtectedRoute roles={['student']}><StudentLayout /></ProtectedRoute>}>
          <Route index element={<StudentDashboard />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="scholarships" element={<ScholarshipsPage />} />
          <Route path="scholarships/:id/apply" element={<ApplicationReviewPage />} />
          <Route path="applications" element={<MyApplicationsPage />} />
          <Route path="applications/:id" element={<ApplicationDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* Verifier routes */}
        <Route path="/verifier" element={<ProtectedRoute roles={['verifier', 'admin']}><VerifierLayout /></ProtectedRoute>}>
          <Route index element={<VerifierDashboard />} />
          <Route path="registrations" element={<RegistrationQueuePage />} />
          <Route path="applications" element={<ApplicationQueuePage />} />
          <Route path="applications/:id" element={<ApplicationReviewAdminPage />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="students" element={<StudentMasterPage />} />
          <Route path="students/import" element={<StudentImportPage />} />
          <Route path="verifiers" element={<VerifierManagementPage />} />
          <Route path="scholarships" element={<ScholarshipManagementPage />} />
          <Route path="scholarships/new" element={<ScholarshipFormPage />} />
          <Route path="scholarships/:id/edit" element={<ScholarshipFormPage />} />
          <Route path="applications" element={<AdminApplicationsPage />} />
          <Route path="applications/:id" element={<ApplicationReviewAdminPage />} />
          <Route path="promote" element={<PromotionPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={
          <div className="auth-page">
            <div style={{ textAlign: 'center' }}>
              <h1>404 — Page Not Found</h1>
              <a href="/" className="btn btn-primary" style={{ marginTop: 16 }}>Go home</a>
            </div>
          </div>
        } />
      </Routes>
    </>
  );
}
