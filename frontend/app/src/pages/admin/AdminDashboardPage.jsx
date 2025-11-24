import { useEffect, useState } from 'react';
import dashboardApi from '../../api/dashboardApi';
import adminApi from '../../api/adminApi';

const cards = [
  { key: 'cases', label: 'תיקים פעילים', icon: '📂' },
  { key: 'clients', label: 'לקוחות', icon: '👥' },
  { key: 'files', label: 'קבצים', icon: '📁' },
  { key: 'users', label: 'משתמשים במשרד', icon: '🧑‍💼' },
];

function AdminDashboardPage() {
  const [officeName, setOfficeName] = useState('');
  const [officeSerial, setOfficeSerial] = useState('');
  const [counts, setCounts] = useState({ cases: 0, clients: 0, files: 0, users: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [name, serial, cases, clients, files, users] = await Promise.all([
          adminApi.getOfficeName(),
          adminApi.getOfficeSerial(),
          dashboardApi.fetchOfficeCases(),
          dashboardApi.fetchOfficeClients(),
          dashboardApi.fetchOfficeFiles(),
          dashboardApi.fetchOfficeUsers(),
        ]);
        setOfficeName(name);
        setOfficeSerial(serial);
        setCounts({
          cases: cases.length,
          clients: clients.length,
          files: files.length,
          users: users.length,
        });
      } catch (err) {
        setError(err.message || 'טעינת הדשבורד נכשלה');
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
          <h2 className="h5 mb-1">ברוך הבא לאזור הניהול</h2>
          <p className="text-muted mb-0">צפייה בתמונה כוללת של המשרד והמשתמשים.</p>
        </div>
        <div className="text-end small text-muted">
          <div>משרד: <span className="fw-semibold">{officeName || '---'}</span></div>
          <div>מספר משרד: <span className="fw-semibold">{officeSerial || '---'}</span></div>
        </div>
      </div>

      {loading && <div className="alert alert-info mb-3">טוען נתונים...</div>}
      {error && <div className="alert alert-danger mb-3">{error}</div>}

      <div className="row g-3">
        {cards.map((card) => (
          <div className="col-12 col-md-6 col-lg-3" key={card.key}>
            <div className="border rounded-3 h-100 p-3 bg-light-subtle">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fs-4" aria-hidden>{card.icon}</span>
                <span className="badge text-bg-primary">דשבורד</span>
              </div>
              <h3 className="h6 text-muted mb-1">{card.label}</h3>
              <p className="display-6 fw-semibold mb-0">{counts[card.key]}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 alert alert-secondary">
        <p className="mb-1 fw-semibold">הערה</p>
        <p className="mb-0">
          הדשבורד משתמש בנתונים הקיימים של המשרד הנוכחי (תיקים, לקוחות, קבצים ומשתמשים). במידת הצורך ניתן
          להרחיב לטעינת נתונים בין-משרדיים כאשר יתווסף endpoint ייעודי.
        </p>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
