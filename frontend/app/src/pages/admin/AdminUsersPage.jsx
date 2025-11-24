import { useEffect, useMemo, useState } from 'react';
import adminApi from '../../api/adminApi';

const initialNewUser = {
  officeName: '',
  username: '',
  password: '',
  email: '',
  roles: ['office_owner'],
};

function AdminUsersPage() {
  const [roles, setRoles] = useState([]);
  const [officeSerial, setOfficeSerial] = useState('');
  const [officeName, setOfficeName] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newUser, setNewUser] = useState(initialNewUser);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');

  const roleOptions = useMemo(() => {
    return roles.length
      ? roles
      : [
          { value: 'admin', label: 'מנהל מערכת' },
          { value: 'office_owner', label: 'בעל משרד' },
          { value: 'office_staff', label: 'צוות משרד' },
        ];
  }, [roles]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [rolesList, name, serial, existingUsers] = await Promise.all([
          adminApi.getRolesList().catch(() => []),
          adminApi.getOfficeName(),
          adminApi.getOfficeSerial(),
          adminApi.getOfficeUsers(),
        ]);
        setRoles(rolesList);
        setOfficeName(name);
        setOfficeSerial(serial);
        setUsers(existingUsers);
        setNewUser((prev) => ({ ...prev, officeName: name || prev.officeName }));
      } catch (err) {
        setError(err.message || 'טעינת המשתמשים נכשלה');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function toggleRole(value, stateUpdater) {
    stateUpdater((prev) => {
      const hasRole = prev.roles.includes(value);
      let nextRoles;
      if (value === 'admin') {
        nextRoles = hasRole ? [] : ['admin'];
      } else {
        nextRoles = hasRole
          ? prev.roles.filter((r) => r !== value)
          : [...prev.roles.filter((r) => r !== 'admin'), value];
      }
      return { ...prev, roles: nextRoles.length ? nextRoles : prev.roles };
    });
  }

  async function refreshUsers() {
    try {
      const officeUsers = await adminApi.getOfficeUsers();
      setUsers(officeUsers);
    } catch (err) {
      setError(err.message || 'טעינת משתמשים נכשלה');
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await adminApi.addUser(newUser);
      setMessage('המשתמש נוסף בהצלחה');
      setNewUser({ ...initialNewUser, officeName: newUser.officeName || officeName });
      await refreshUsers();
    } catch (err) {
      setError(err.message || 'שמירת משתמש נכשלה');
    }
  }

  function startEdit(user) {
    setEditing({
      username: user.username || '',
      officeSerial: user.office_serial || officeSerial,
      email: user.email || '',
      password: '',
      roles: user.roles || [],
      officeName: user.office_name || officeName,
    });
    setMessage('');
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setMessage('');
    setError('');
    try {
      await adminApi.editUser(editing);
      setMessage('המשתמש עודכן');
      setEditing(null);
      await refreshUsers();
    } catch (err) {
      setError(err.message || 'עדכון המשתמש נכשל');
    }
  }

  async function handleDelete(user) {
    if (!window.confirm(`למחוק את המשתמש ${user.username}?`)) return;
    setMessage('');
    setError('');
    try {
      await adminApi.deleteUser({
        username: user.username,
        officeSerial: user.office_serial || officeSerial,
      });
      setMessage('המשתמש נמחק');
      await refreshUsers();
    } catch (err) {
      setError(err.message || 'מחיקה נכשלה');
    }
  }

  return (
    <div className="bg-white rounded-3 shadow-sm p-4" dir="rtl">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h2 className="h5 mb-1">ניהול משתמשים</h2>
          <p className="text-muted mb-0">הוספה, עריכה ומחיקה של משתמשי משרד תוך שמירה על עוגיות וסשן קיים.</p>
        </div>
        <div className="text-end small text-muted">
          <div>משרד: <span className="fw-semibold">{officeName || '---'}</span></div>
          <div>מספר משרד: <span className="fw-semibold">{officeSerial || '---'}</span></div>
        </div>
      </div>

      {loading && <div className="alert alert-info">טוען נתונים...</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="border rounded-3 p-3 h-100 bg-light-subtle">
            <h3 className="h6 mb-3">הוספת משתמש חדש</h3>
            <form className="row g-3" onSubmit={handleCreate}>
              <div className="col-12">
                <label className="form-label">שם משרד</label>
                <input
                  type="text"
                  className="form-control"
                  value={newUser.officeName}
                  onChange={(e) => setNewUser({ ...newUser, officeName: e.target.value })}
                  placeholder="שם המשרד"
                  required
                />
              </div>
              <div className="col-12">
                <label className="form-label">שם משתמש</label>
                <input
                  type="text"
                  className="form-control"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="שם משתמש"
                  required
                />
              </div>
              <div className="col-12">
                <label className="form-label">סיסמה</label>
                <input
                  type="password"
                  className="form-control"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="סיסמה"
                  required
                />
              </div>
              <div className="col-12">
                <label className="form-label">אימייל</label>
                <input
                  type="email"
                  className="form-control"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="col-12">
                <label className="form-label">תפקידים</label>
                <div className="d-flex flex-wrap gap-2">
                  {roleOptions.map((role) => (
                    <label key={role.value} className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={newUser.roles.includes(role.value)}
                        onChange={() => toggleRole(role.value, setNewUser)}
                      />
                      <span className="ms-2">{role.label}</span>
                    </label>
                  ))}
                </div>
                <small className="text-muted d-block mt-1">תפקיד "admin" הוא בלעדי ולא ניתן לשלב עם אחרים.</small>
              </div>
              <div className="col-12 d-grid">
                <button type="submit" className="btn btn-primary">שמור משתמש</button>
              </div>
            </form>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="border rounded-3 p-3 bg-white h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="h6 mb-0">משתמשי המשרד</h3>
              <span className="badge text-bg-secondary">{users.length}</span>
            </div>
            <div className="table-responsive">
              <table className="table align-middle table-sm text-end">
                <thead className="table-light">
                  <tr>
                    <th>שם משתמש</th>
                    <th>תפקידים</th>
                    <th>אימייל</th>
                    <th>תאריך יצירה</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-3">
                        אין משתמשים להצגה
                      </td>
                    </tr>
                  )}
                  {users.map((user) => (
                    <tr key={`${user.office_serial || 'office'}-${user.username}`}>
                      <td className="fw-semibold">{user.username}</td>
                      <td>{(user.roles || []).join(', ') || '---'}</td>
                      <td>{user.email || '---'}</td>
                      <td>{user.created_at || '---'}</td>
                      <td>
                        <div className="d-flex gap-2 justify-content-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => startEdit(user)}
                          >
                            עריכה
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(user)}
                          >
                            מחיקה
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editing && (
              <div className="mt-4 border-top pt-3">
                <h4 className="h6 mb-3">עריכת משתמש: {editing.username}</h4>
                <form className="row g-3" onSubmit={handleEdit}>
                  <div className="col-12">
                    <label className="form-label">מספר משרד</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editing.officeSerial}
                      onChange={(e) => setEditing({ ...editing, officeSerial: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">אימייל</label>
                    <input
                      type="email"
                      className="form-control"
                      value={editing.email}
                      onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">סיסמה חדשה (אופציונלי)</label>
                    <input
                      type="password"
                      className="form-control"
                      value={editing.password}
                      onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">תפקידים</label>
                    <div className="d-flex flex-wrap gap-2">
                      {roleOptions.map((role) => (
                        <label key={role.value} className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={editing.roles.includes(role.value)}
                            onChange={() => toggleRole(role.value, setEditing)}
                          />
                          <span className="ms-2">{role.label}</span>
                        </label>
                      ))}
                    </div>
                    <small className="text-muted d-block mt-1">admin נשאר בלעדי גם במסך העריכה.</small>
                  </div>
                  <div className="col-12 d-flex gap-2">
                    <button type="submit" className="btn btn-primary">עדכן</button>
                    <button type="button" className="btn btn-outline-secondary" onClick={() => setEditing(null)}>
                      ביטול
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminUsersPage;
