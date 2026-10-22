import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { getStatusLabel, getStatusClass, formatDate } from '../../utils/helpers.js';
import { ClipboardList } from 'lucide-react';

export default function MyApplicationsPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/applications/my').then(res => { setApps(res.data.applications || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Applications</h1>
      </div>

      {apps.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={40} />
          <div className="empty-state-title">No applications yet</div>
          <p className="empty-state-desc">Browse open scholarships and submit your first application.</p>
          <Link to="/student/scholarships" className="btn btn-primary" style={{ marginTop: 8 }}>Browse Scholarships</Link>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Scholarship</th>
                <th>Academic Year</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {apps.map(app => (
                <tr key={app._id}>
                  <td style={{ fontWeight: 500 }}>{app.scholarship?.title || 'Scholarship'}</td>
                  <td>{app.academicYear}</td>
                  <td>{app.submittedAt ? formatDate(app.submittedAt) : '—'}</td>
                  <td><span className={getStatusClass(app.status)}>{getStatusLabel(app.status)}</span></td>
                  <td>
                    <Link to={`/student/applications/${app._id}`} className="btn btn-ghost btn-sm">
                      View details
                    </Link>
                    {app.status === 'action_required' && (
                      <Link to={`/student/applications/${app._id}`} className="btn btn-danger btn-sm" style={{ marginLeft: 6 }}>
                        Fix issues
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
