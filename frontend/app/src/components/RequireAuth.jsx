import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getSession } from '../api/authApi';

const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
};

function RequireAuth() {
  const [status, setStatus] = useState(STATUS.LOADING);
  const [session, setSession] = useState(null);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      try {
        const response = await getSession();
        if (!isMounted) return;
        setSession(response?.data || null);
        setStatus(STATUS.AUTHENTICATED);
      } catch (err) {
        if (!isMounted) return;
        setStatus(STATUS.UNAUTHENTICATED);
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === STATUS.LOADING) {
    return (
      <div className="container py-5" dir="rtl">
        <div className="d-flex justify-content-center align-items-center gap-3">
          <div className="spinner-border text-primary" role="status" aria-hidden="true" />
          <div>
            <p className="mb-0 fw-semibold">בודק הרשאות…</p>
            <small className="text-muted">מתחבר בעזרת עוגיות (credentials: "include")</small>
          </div>
        </div>
      </div>
    );
  }

  if (status === STATUS.UNAUTHENTICATED) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet context={{ session }} />;
}

export default RequireAuth;
