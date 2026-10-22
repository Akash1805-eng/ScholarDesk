import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function NotificationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await api.get('/notifications?unreadOnly=true&limit=1');
        if (!cancelled) setCount(res.data.unreadCount || 0);
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000); // poll every minute
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (count === 0) return null;
  return <span className="notif-count" aria-label={`${count} unread notifications`}>{count > 99 ? '99+' : count}</span>;
}
