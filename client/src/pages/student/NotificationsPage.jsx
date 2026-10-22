import { useState, useEffect } from 'react';
import api from '../../services/api.js';
import { formatDate } from '../../utils/helpers.js';
import { Bell, Check, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_STYLES = {
  application_approved: { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  application_rejected: { bg: 'var(--color-error-bg)', color: 'var(--color-error)' },
  correction_requested: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  account_approved:     { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  document_expiry_warning: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  document_expired:     { bg: 'var(--color-error-bg)', color: 'var(--color-error)' },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications?limit=50');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(ns => ns.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(ns => ns.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read.');
    } catch {}
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Notifications</h1>
          {unreadCount > 0 && <p className="page-subtitle">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <div className="page-actions">
            <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
              <CheckCheck size={14} />
              Mark all read
            </button>
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <Bell size={40} />
          <div className="empty-state-title">No notifications</div>
          <p className="empty-state-desc">You're all caught up!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifications.map(n => {
            const style = TYPE_STYLES[n.type] || {};
            return (
              <div key={n._id} style={{
                padding: '14px 16px',
                background: n.isRead ? 'var(--color-surface)' : 'var(--color-primary-light)',
                border: `1px solid ${n.isRead ? 'var(--color-border)' : 'var(--color-primary)'}`,
                borderRadius: 'var(--radius)',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                transition: 'var(--transition)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                  background: style.bg || 'var(--color-surface-hover)',
                  color: style.color || 'var(--color-text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Bell size={14} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: n.isRead ? 450 : 600, fontSize: '0.9375rem' }}>{n.title}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{n.message}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: 4 }}>
                    {formatDate(n.createdAt, { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {!n.isRead && (
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => markRead(n._id)} title="Mark as read" aria-label="Mark as read">
                    <Check size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
