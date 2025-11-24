import { useEffect, useState } from 'react';
import adminApi from '../../api/adminApi';

function OfficeSettingsPage() {
  const [officeName, setOfficeName] = useState('');
  const [officeSerial, setOfficeSerial] = useState('');
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [name, serial, rolesList] = await Promise.all([
          adminApi.getOfficeName(),
          adminApi.getOfficeSerial(),
          adminApi.getRolesList().catch(() => []),
        ]);
        setOfficeName(name);
        setOfficeSerial(serial);
        setRoles(rolesList);
      } catch (err) {
        setError(err.message || 'טעינת נתוני המשרד נכשלה');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="bg-white rounded-3 shadow-sm p-4" dir="rtl">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h2 className="h5 mb-1">הגדרות משרד</h2>
          <p className="text-muted mb-0">נתוני זיהוי המשרד ותרשים התפקידים הקיימים.</p>
        </div>
        <div className="text-end small text-muted">
          <div>משרד: <span className="fw-semibold">{officeName || '---'}</span></div>
          <div>מספר משרד: <span className="fw-semibold">{officeSerial || '---'}</span></div>
        </div>
      </div>

      {loading && <div className="alert alert-info">טוען נתונים...</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="border rounded-3 p-3 bg-light-subtle h-100">
            <h3 className="h6 mb-2">זיהוי המשרד</h3>
            <p className="mb-1">שם המשרד כפי שמופיע בנתוני הסשן.</p>
            <div className="p-2 bg-white rounded border mb-2">{officeName || '---'}</div>
            <p className="mb-1">מספר המשרד הקיים במאגר.</p>
            <div className="p-2 bg-white rounded border">{officeSerial || '---'}</div>
            <small className="text-muted d-block mt-2">
              ערכים אלה מגיעים מ-`/get_office_name` ו-`/get_office_serial` וימשיכו להיות המקור למזהי המשרד עבור תהליכי
              אדמין אחרים.
            </small>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="border rounded-3 p-3 h-100">
            <h3 className="h6 mb-3">תפקידי מערכת</h3>
            <p className="text-muted">רשימת התפקידים הטעונה מ-`/get_roles_list` לצורך ניהול משתמשים.</p>
            <ul className="list-group">
              {roles.length === 0 && <li className="list-group-item text-muted">לא נטענו תפקידים</li>}
              {roles.map((role) => (
                <li key={role.value} className="list-group-item d-flex justify-content-between align-items-center">
                  <span>{role.label}</span>
                  <span className="badge text-bg-light">{role.value}</span>
                </li>
              ))}
            </ul>
            <small className="text-muted d-block mt-2">
              לוגיקת הרשאות נשארת בצד השרת; כאן רק מוצגת הרשימה לצורך בחירה בטפסים.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OfficeSettingsPage;
