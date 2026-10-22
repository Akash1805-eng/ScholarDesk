import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { Search, Upload, Filter, Users, CheckCircle, XCircle } from 'lucide-react';

export default function StudentMasterPage() {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [academicYear, setAcademicYear] = useState('');

  const LIMIT = 25;

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page,
        limit: LIMIT,
        ...(search ? { search: search.trim() } : {}),
        ...(department ? { department } : {}),
        ...(year ? { year } : {}),
        ...(academicYear ? { academicYear } : {}),
      });
      const res = await api.get(`/admin/students?${q.toString()}`);
      setStudents(res.data.records || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [page, department, year, academicYear]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchStudents();
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div className="page-header-content">
          <h1 className="page-title">Student Master Registry</h1>
          <p className="page-subtitle">Authorized institutional records used to validate student identity during registration.</p>
        </div>
        <Link to="/admin/students/import" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Upload size={16} /> Batch Import Students
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 240px' }}>
            <label className="form-label" style={{ fontSize: '0.8125rem' }}>Search by Name / Reg No</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 310624... or Akash"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 36 }}
              />
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            </div>
          </div>

          <div style={{ flex: '0 1 140px' }}>
            <label className="form-label" style={{ fontSize: '0.8125rem' }}>Department</label>
            <select
              className="form-input"
              value={department}
              onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
            >
              <option value="">All</option>
              <option value="CSE">CSE</option>
              <option value="ECE">ECE</option>
              <option value="EEE">EEE</option>
              <option value="MECH">MECH</option>
              <option value="CIVIL">CIVIL</option>
              <option value="IT">IT</option>
              <option value="AIDS">AIDS</option>
            </select>
          </div>

          <div style={{ flex: '0 1 120px' }}>
            <label className="form-label" style={{ fontSize: '0.8125rem' }}>Year</label>
            <select
              className="form-input"
              value={year}
              onChange={(e) => { setYear(e.target.value); setPage(1); }}
            >
              <option value="">All</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </div>

          <div style={{ flex: '0 1 140px' }}>
            <label className="form-label" style={{ fontSize: '0.8125rem' }}>Academic Year</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 2026-2027"
              value={academicYear}
              onChange={(e) => { setAcademicYear(e.target.value); setPage(1); }}
            />
          </div>

          <button type="submit" className="btn btn-secondary">
            Apply Filters
          </button>
        </form>
      </div>

      {/* Table Data */}
      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : students.length === 0 ? (
        <div className="card empty-state" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Users size={48} style={{ color: 'var(--color-text-muted)', margin: '0 auto 16px' }} />
          <div className="empty-state-title">No student records found</div>
          <p className="empty-state-desc" style={{ color: 'var(--color-text-muted)' }}>
            No records matched your search filters. Try adjusting your query or import students.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Reg Number</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Name</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>College Email</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Dept & Year</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Academic Year</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Portal Account</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st) => (
                  <tr key={st._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {st.registerNumber}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--color-heading)' }}>
                      {st.name}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      {st.collegeEmail}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      {st.department} · Year {st.currentYear}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      {st.academicYear}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${st.studentStatus === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                        {st.studentStatus}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {st.registeredUser ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-success)', fontSize: '0.8125rem', fontWeight: 500 }}>
                          <CheckCircle size={14} /> Registered
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                          <XCircle size={14} /> Unclaimed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Page {page} of {totalPages} ({total} total records)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
