import { useEffect, useMemo, useState } from 'react';
import dashboardApi from '../../api/dashboardApi';

function RoleBadge({ role }) {
  const colors = {
    admin: 'danger',
    manager: 'primary',
    staff: 'secondary',
  };
  const variant = colors[role] || 'info';
  return (
    <span className={`badge text-bg-${variant} me-1`}>{role}</span>
  );
}

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [officeName, setOfficeName] = useState('');
  const [username, setUsername] = useState('');
  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [office, user, officeUsers, officeCases, officeClients] = await Promise.all([
          dashboardApi.fetchOfficeName(),
          dashboardApi.fetchUsername(),
          dashboardApi.fetchOfficeUsers(),
          dashboardApi.fetchOfficeCases(),
          dashboardApi.fetchOfficeClients(),
        ]);

        if (!active) return;
        setOfficeName(office);
        setUsername(user);
        setUsers(officeUsers);
        setCases(officeCases);
        setClients(officeClients);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'שגיאה בטעינת נתוני האדמין.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const roleBreakdown = useMemo(() => {
    return users.reduce((acc, user) => {
      (user.roles || []).forEach((role) => {
        acc[role] = (acc[role] || 0) + 1;
      });
      return acc;
    }, {});
  }, [users]);

  return (
    <section className="d-flex flex-column gap-4" dir="rtl">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
        <div>
          <p className="text-muted small mb-1">דשבורד אדמין</p>
          <h2 className="h4 mb-1">שלום, {username || 'אדמין'}</h2>
          <p className="mb-0 text-secondary">משרד: {officeName || '---'}</p>
        </div>
        <div className="text-end">
          <span className="badge text-bg-warning text-dark">ניהול משתמשים ומדדים</span>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary" role="status" aria-label="טוען" />
        </div>
      ) : (
        <>
          <div className="row g-3">
            <div className="col-12 col-md-6 col-xl-3">
              <div className="card border-0 shadow-sm h-100" dir="rtl">
                <div className="card-body">
                  <p className="text-muted small mb-1">סה\"כ משתמשים</p>
                  <h3 className="fw-bold mb-0">{users.length}</h3>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <div className="card border-0 shadow-sm h-100" dir="rtl">
                <div className="card-body">
                  <p className="text-muted small mb-1">סה\"כ תיקים</p>
                  <h3 className="fw-bold mb-0">{cases.length}</h3>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <div className="card border-0 shadow-sm h-100" dir="rtl">
                <div className="card-body">
                  <p className="text-muted small mb-1">סה\"כ לקוחות</p>
                  <h3 className="fw-bold mb-0">{clients.length}</h3>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <div className="card border-0 shadow-sm h-100" dir="rtl">
                <div className="card-body">
                  <p className="text-muted small mb-1">תפקידים במערכת</p>
                  <div className="d-flex flex-wrap gap-2">
                    {Object.entries(roleBreakdown).length === 0 && (
                      <span className="text-muted small">TODO: מושך תפקידים מהדשבורד הישן</span>
                    )}
                    {Object.entries(roleBreakdown).map(([role, count]) => (
                      <span key={role} className="text-nowrap">
                        <RoleBadge role={role} /> {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm" dir="rtl">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="h6 mb-0">משתמשים אחרונים</h3>
                <span className="text-muted small">מקור: /get_office_users</span>
              </div>
              {users.length === 0 ? (
                <p className="text-muted mb-0">לא נמצאו משתמשים להצגה.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th scope="col">שם משתמש</th>
                        <th scope="col">אימייל</th>
                        <th scope="col">תפקידים</th>
                        <th scope="col">תאריך יצירה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users
                        .slice()
                        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                        .slice(0, 8)
                        .map((userRow) => (
                          <tr key={userRow.username || userRow.user_serial}>
                            <td className="fw-semibold">{userRow.username || '---'}</td>
                            <td>{userRow.email || '---'}</td>
                            <td>
                              {(userRow.roles || []).map((role) => (
                                <RoleBadge key={`${userRow.username}-${role}`} role={role} />
                              ))}
                            </td>
                            <td>{userRow.created_at ? new Date(userRow.created_at).toLocaleDateString('he-IL') : '---'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default AdminDashboard;
