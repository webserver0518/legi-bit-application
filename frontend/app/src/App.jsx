import { useCallback, useEffect, useMemo, useState } from 'react';

const proxiedRoutes = [
  { path: '/login', description: 'Form POST with username, password, optional mfa_code', method: 'POST' },
  { path: '/logout', description: 'Clears session and redirects to home', method: 'GET' },
  { path: '/auth_debug', description: 'Returns current session/auth context (read-only)', method: 'GET' },
  { path: '/api/*', description: 'Use for JSON APIs exposed by Flask (cases, files, etc.)', method: 'MIXED' }
];

function App() {
  const [sessionData, setSessionData] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('idle');
  const [error, setError] = useState('');

  const fetchSession = useCallback(
    async (signal) => {
      setSessionStatus('loading');
      setError('');

      try {
        const response = await fetch('/auth_debug', {
          credentials: 'include',
          signal,
        });

        if (!response.ok) {
          throw new Error(`Session check failed (${response.status})`);
        }

        const data = await response.json();
        setSessionData(data);
        setSessionStatus('ready');
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Unknown error');
        setSessionStatus('error');
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchSession(controller.signal);

    return () => controller.abort();
  }, [fetchSession]);

  const sessionBody = useMemo(() => {
    if (sessionStatus === 'loading') return 'Loading session from backend...';
    if (sessionStatus === 'error') return `Unable to load session: ${error}`;
    if (sessionStatus === 'ready' && sessionData) return JSON.stringify(sessionData, null, 2);
    return 'No session established yet.';
  }, [error, sessionData, sessionStatus]);

  return (
    <div className="container py-5">
      <header className="mb-4 text-center">
        <p className="text-uppercase fw-semibold text-muted">Legi-Bit Platform</p>
        <h1 className="fw-bold">React SPA Shell</h1>
        <p className="lead">
          SPA assets are served by Nginx with backend requests proxied on the same origin.
          All fetches use <code>credentials: 'include'</code> to honor Redis-backed sessions.
        </p>
      </header>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
              <span>Session state</span>
              <span className="badge text-bg-light text-uppercase">{sessionStatus}</span>
            </div>
            <div className="card-body">
              <div className="d-flex gap-2 mb-3 flex-wrap">
                <a className="btn btn-outline-primary" href="/login">
                  Go to login
                </a>
                <button
                  className="btn btn-secondary"
                  disabled={sessionStatus === 'loading'}
                  onClick={() => fetchSession()}
                >
                  Refresh session
                </button>
              </div>
              <p className="text-muted small mb-2">
                Data comes from <code>/auth_debug</code> using <code>credentials: 'include'</code>.
                Use the existing login flow at <code>/login</code> to populate it.
              </p>
              <pre className="bg-light p-3 rounded border session-preview">{sessionBody}</pre>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-dark text-white">Backend routes exposed via Nginx</div>
            <div className="card-body">
              <p className="text-muted small">All routes share the same origin; no CORS is needed.</p>
              <ul className="list-group list-group-flush">
                {proxiedRoutes.map((route) => (
                  <li key={route.path} className="list-group-item d-flex justify-content-between align-items-start">
                    <div>
                      <p className="mb-1 fw-semibold">{route.path}</p>
                      <p className="mb-0 small text-muted">{route.description}</p>
                    </div>
                    <span className="badge text-bg-secondary">{route.method}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="alert alert-info mt-4" role="alert">
        <strong>Tip:</strong> The legacy templates are still reachable for parity. Once the React UI replaces them,
        keep only the JSON endpoints and shared auth routes.
      </div>
    </div>
  );
}

export default App;
