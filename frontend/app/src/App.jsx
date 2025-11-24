import { useState } from 'react';

function App() {
  const [pingResult, setPingResult] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePing = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/ping', {
        credentials: 'include',
      });

      const payload = await response.text();
      if (!response.ok) {
        throw new Error(payload || 'קריאת ה-API נכשלה');
      }

      setPingResult(payload || 'ה-API החזיר תשובה ריקה');
    } catch (err) {
      setError(err.message || 'לא ניתן להתחבר כרגע ל-API.');
      setPingResult('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="hero-banner mb-4">
        <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center gap-3">
          <div className="flex-grow-1">
            <p className="badge badge-accent text-uppercase fw-semibold mb-2">גרסת ריאקט חדשה</p>
            <h1 className="hero-title mb-2">ברוכים הבאים לממשק המודרני</h1>
            <p className="hero-subtitle mb-0">
              מבוסס React + Vite, כולל Bootstrap RTL וליבה תואמת לממשק הקודם.
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-success" onClick={handlePing} disabled={loading}>
              {loading ? 'בודק חיבור…' : 'בדיקת חיבור ל-API'}
            </button>
            <button type="button" className="btn btn-outline-light" disabled>
              נתמך על ידי cookies (credentials: "include")
            </button>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card card-accent h-100">
            <div className="card-body">
              <h2 className="h5 mb-3">עקרונות אינטגרציה</h2>
              <ul className="mb-3">
                <li>כל פניות ה-fetch יישלחו עם <strong>credentials: "include"</strong> כדי לשמור cookies.</li>
                <li>הנתיבים <code>/login</code>, <code>/logout</code>, <code>/auth/</code>, <code>/api/</code> עוברים דרך Nginx ל-Flask.</li>
                <li>תמיכה מלאה ב-RTL עם Bootstrap 5 RTL והגדרות טיפוגרפיה מהאתר הישן.</li>
              </ul>
              <p className="mb-2">דוגמת קריאה תואמת:</p>
              <code>fetch('/api/ping', { credentials: 'include' });</code>
              <p className="footer-note mb-0 mt-3">הימנעו משימוש ב-jQuery/DataTables; יש להעדיף קומפוננטות React.</p>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card card-accent h-100">
            <div className="card-body">
              <h2 className="h5 mb-3">סטטוס סביבת פיתוח</h2>
              <div className="d-flex flex-column gap-2">
                <div>
                  <span className="badge badge-accent me-2">עיצוב</span>
                  Bootstrap RTL + צבעי מורשת (base_site.css)
                </div>
                <div>
                  <span className="badge badge-accent me-2">בדיקות סטייל</span>
                  npm run lint · npm run lint:fix · npm run format
                </div>
                <div>
                  <span className="badge badge-accent me-2">רינדור</span>
                  Vite dev server (5173) עם Strict Mode
                </div>
              </div>
              <div className="mt-4">
                {pingResult && <div className="alert alert-success mb-2">{pingResult}</div>}
                {error && <div className="alert alert-danger mb-2">{error}</div>}
                {!pingResult && !error && (
                  <p className="text-muted mb-0">
                    השתמשו בכפתור למעלה כדי לוודא שה-proxy של Nginx מנתב את הקריאה ל-API.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
