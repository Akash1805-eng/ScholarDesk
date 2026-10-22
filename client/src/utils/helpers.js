/**
 * Format an application status for display.
 */
export function getStatusLabel(status) {
  const labels = {
    draft: 'Draft',
    submitted: 'Submitted',
    under_verification: 'Under Verification',
    action_required: 'Action Required',
    verified: 'Verified',
    under_final_approval: 'Under Final Approval',
    approved: 'Approved',
    rejected: 'Rejected',
  };
  return labels[status] || status;
}

/**
 * Get CSS class for status badge.
 */
export function getStatusClass(status) {
  return `status-badge status-${status}`;
}

/**
 * Format a document type for display.
 */
export function getDocTypeLabel(type) {
  const labels = {
    identity_proof: 'Identity Proof',
    income_certificate: 'Income Certificate',
    community_certificate: 'Community Certificate',
    marksheet: 'Marksheet',
    first_graduate_certificate: 'First Graduate Certificate',
    disability_certificate: 'Disability Certificate',
    bank_evidence: 'Bank Evidence',
    bonafide_certificate: 'Bonafide Certificate',
  };
  return labels[type] || type;
}

/**
 * Document expiry configuration: defines whether an expiry date field is applicable (optional)
 */
export const DOCUMENT_EXPIRY_CONFIG = {
  identity_proof: { supportsExpiry: true },
  income_certificate: { supportsExpiry: true },
  community_certificate: { supportsExpiry: false },
  marksheet: { supportsExpiry: false },
  first_graduate_certificate: { supportsExpiry: false },
  disability_certificate: { supportsExpiry: true },
  bank_evidence: { supportsExpiry: false },
  bonafide_certificate: { supportsExpiry: false },
};

/**
 * Check if a document type supports an expiry date.
 */
export function supportsExpiryDate(type) {
  return Boolean(DOCUMENT_EXPIRY_CONFIG[type]?.supportsExpiry);
}

/**
 * Format date for display.
 */
export function formatDate(date, opts = {}) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', ...opts,
  });
}

/**
 * Format currency (INR).
 */
export function formatCurrency(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

/**
 * Days until a date (negative = expired).
 */
export function daysUntil(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
}

/**
 * Extract a user-friendly error message from an Axios error.
 */
export function getErrorMessage(err) {
  return err?.response?.data?.message || err?.message || 'An unexpected error occurred.';
}
