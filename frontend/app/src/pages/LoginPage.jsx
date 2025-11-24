import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { login as loginApi } from '../api/authApi';

const STATUS = {
  IDLE: 'idle',
  SUBMITTING: 'submitting',
};

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formValues, setFormValues] = useState({
    username: '',
    password: '',
    mfa_code: '',
  });
  const [requireMfa, setRequireMfa] = useState(false);
  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setStatus(STATUS.SUBMITTING);

    try {
      const response = await loginApi({
        username: formValues.username,
        password: formValues.password,
        mfa_code: requireMfa ? formValues.mfa_code : undefined,
      });

      const { data, message: responseMessage } = response;

      if (data?.require_mfa) {
        setRequireMfa(true);
        setMessage(responseMessage || 'נדרש אימות נוסף. הזינו את קוד ה-MFA.');
        setStatus(STATUS.IDLE);
        return;
      }

      const redirectTarget =
        location.state?.from?.pathname || data?.redirect || '/app/dashboard';

      setStatus(STATUS.IDLE);
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setStatus(STATUS.IDLE);
      setError(err?.message || 'התחברות נכשלה');

      const payloadData = err?.payload?.data;
      if (payloadData?.require_mfa && !requireMfa) {
        setRequireMfa(true);
        setMessage('שם משתמש וסיסמה תקינים, נדרש קוד MFA לאימות.');
      }
    }
  };

  const isSubmitting = status === STATUS.SUBMITTING;

  return (
    <div className="card shadow-sm" dir="rtl">
      <div className="card-body">
        <p className="text-uppercase text-muted small mb-2">התחברות</p>
        <h2 className="h4 mb-3">כניסה לחשבון</h2>
        <p className="mb-3 text-muted">
          ההתחברות משתמשת בעוגיות קיימות דרך Nginx (credentials: "include"), בהתאם
          למענה של ResponseManager בפורמט {`{ data, error, message, status, success }`}.
        </p>

        <form className="needs-validation" noValidate onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="username">
              שם משתמש
            </label>
            <input
              type="text"
              id="username"
              name="username"
              className="form-control"
              value={formValues.username}
              onChange={handleChange}
              autoComplete="username"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="password">
              סיסמה
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-control"
              value={formValues.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
              disabled={isSubmitting}
            />
          </div>

          {requireMfa && (
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="mfa_code">
                קוד MFA (6 ספרות)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\\d{6}"
                id="mfa_code"
                name="mfa_code"
                className="form-control"
                value={formValues.mfa_code}
                onChange={handleChange}
                autoComplete="one-time-code"
                minLength={6}
                maxLength={6}
                required
                disabled={isSubmitting}
              />
              <div className="form-text">קוד זמני נדרש להמשך התחברות.</div>
            </div>
          )}

          {message && (
            <div className="alert alert-info" role="status">
              {message}
            </div>
          )}

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <div className="d-flex align-items-center gap-3">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'מתחבר…' : requireMfa ? 'אימות כניסה' : 'כניסה'}
            </button>
            {isSubmitting && (
              <div className="d-flex align-items-center gap-2 text-muted">
                <div className="spinner-border spinner-border-sm" role="status" />
                <span className="small">שולח בקשה…</span>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
