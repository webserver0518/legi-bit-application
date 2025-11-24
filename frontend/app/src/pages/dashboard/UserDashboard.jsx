import { useEffect, useMemo, useState } from 'react';
import dashboardApi from '../../api/dashboardApi';

function formatDate(value) {
  if (!value) return '---';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('he-IL');
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className="col-12 col-md-6 col-xl-3">
      <div className="card shadow-sm border-0 h-100" dir="rtl">
        <div className="card-body">
          <p className="text-muted small mb-1">{label}</p>
          <h3 className="fw-bold mb-0" style={{ color: accent }}>{value}</h3>
        </div>
      </div>
    </div>
  );
}

function RecentList({ title, items, getPrimary, getSecondary, emptyText }) {
  return (
    <div className="card shadow-sm border-0 h-100" dir="rtl">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h3 className="h6 mb-0">{title}</h3>
        </div>
        {items.length === 0 ? (
          <p className="text-muted mb-0">{emptyText}</p>
        ) : (
          <ul className="list-group list-group-flush">
            {items.map((item) => (
              <li key={getPrimary(item)} className="list-group-item px-0">
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <div className="fw-semibold">{getPrimary(item)}</div>
                    <div className="text-muted small">{getSecondary(item)}</div>
                  </div>
                  <span className="badge text-bg-light">{formatDate(item.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function UserDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [officeName, setOfficeName] = useState('');
  const [username, setUsername] = useState('');
  const [cases, setCases] = useState([]);
  const [clients, setClients] = useState([]);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [officeNameRes, usernameRes, casesRes, clientsRes, filesRes] =
          await Promise.all([
            dashboardApi.fetchOfficeName(),
            dashboardApi.fetchUsername(),
            dashboardApi.fetchOfficeCases(),
            dashboardApi.fetchOfficeClients(),
            dashboardApi.fetchOfficeFiles(),
          ]);

        if (!active) return;
        setOfficeName(officeNameRes);
        setUsername(usernameRes);
        setCases(casesRes);
        setClients(clientsRes);
        setFiles(filesRes);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'אירעה שגיאה בעת טעינת הנתונים.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const recentCases = useMemo(() => {
    return [...cases]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 5);
  }, [cases]);

  const recentClients = useMemo(() => {
    return [...clients]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 5);
  }, [clients]);

  const stats = {
    caseCount: cases.length,
    clientCount: clients.length,
    fileCount: files.length,
  };

  return (
    <section className="d-flex flex-column gap-4" dir="rtl">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
        <div>
          <p className="text-muted small mb-1">לוח בקרה</p>
          <h2 className="h4 mb-1">שלום, {username || 'משתמש'}</h2>
          <p className="mb-0 text-secondary">משרד: {officeName || '---'}</p>
        </div>
        <div className="text-end">
          <span className="badge text-bg-primary">נתונים מתוך המערכת</span>
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
            <SummaryCard label="סה\"כ תיקים" value={stats.caseCount} accent="#0d6efd" />
            <SummaryCard label="סה\"כ לקוחות" value={stats.clientCount} accent="#6610f2" />
            <SummaryCard label="סה\"כ קבצים" value={stats.fileCount} accent="#198754" />
            <SummaryCard
              label="הודעת מערכת"
              value={officeName || '---'}
              accent="#0dcaf0"
            />
          </div>

          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <RecentList
                title="תיקים אחרונים"
                items={recentCases}
                getPrimary={(item) => item.title || item.name || `תיק ${item.case_serial || ''}`}
                getSecondary={(item) =>
                  item.status || item.field || 'סטטוס לא זמין (TODO: למפות מהדשבורד הישן)'
                }
                emptyText="לא נמצאו תיקים להצגה."
              />
            </div>
            <div className="col-12 col-lg-6">
              <RecentList
                title="לקוחות אחרונים"
                items={recentClients}
                getPrimary={(item) =>
                  item.full_name || item.name || item.first_name || `לקוח ${item.client_serial || ''}`
                }
                getSecondary={(item) =>
                  item.phone || item.email || 'פרטי התקשרות לא זמינים (TODO: לאמת מול ה-API)'
                }
                emptyText="לא נמצאו לקוחות להצגה."
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default UserDashboard;
