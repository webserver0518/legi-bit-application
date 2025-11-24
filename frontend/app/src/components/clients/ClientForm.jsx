import { useEffect, useMemo, useState } from 'react';

const initialState = {
  first_name: '',
  last_name: '',
  id_card_number: '',
  phone: '',
  email: '',
  city: '',
  street: '',
  home_number: '',
  postal_code: '',
  birth_date: '',
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+\-()\s]{7,}$/;

function ClientForm({ initialValues, onSubmit, mode = 'create' }) {
  const [formState, setFormState] = useState({ ...initialState, ...initialValues });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFormState((prev) => ({ ...prev, ...initialState, ...initialValues }));
  }, [initialValues]);

  const subtitle = useMemo(() => {
    return mode === 'edit' ? 'עדכון פרטי לקוח קיים' : 'הוספת לקוח חדש למשרד';
  }, [mode]);

  const updateField = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formState.first_name.trim()) {
      setError('יש למלא שם פרטי');
      return;
    }

    if (formState.email && !emailPattern.test(formState.email)) {
      setError('פורמט אימייל לא תקין');
      return;
    }

    if (formState.phone && !phonePattern.test(formState.phone)) {
      setError('פורמט טלפון לא תקין');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formState);
    } catch (err) {
      setError(err.message || 'הפעולה נכשלה');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} dir="rtl">
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
            <div>
              <h1 className="h4 mb-1">{mode === 'edit' ? 'עדכון לקוח' : 'לקוח חדש'}</h1>
              <p className="text-muted mb-0">{subtitle}</p>
            </div>
            <button type="submit" className="btn btn-success" disabled={submitting}>
              {submitting ? 'שומר...' : mode === 'edit' ? 'שמירת שינויים' : 'יצירה'}
            </button>
          </div>

          {error ? (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          ) : null}

          <div className="row g-3">
            <div className="col-12 col-md-4">
              <label className="form-label">שם פרטי *</label>
              <input
                type="text"
                className="form-control"
                value={formState.first_name}
                onChange={(e) => updateField('first_name', e.target.value)}
                required
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">שם משפחה</label>
              <input
                type="text"
                className="form-control"
                value={formState.last_name}
                onChange={(e) => updateField('last_name', e.target.value)}
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">תעודת זהות</label>
              <input
                type="text"
                className="form-control"
                value={formState.id_card_number || ''}
                onChange={(e) => updateField('id_card_number', e.target.value)}
                placeholder="9 ספרות"
              />
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label">אימייל</label>
              <input
                type="email"
                className="form-control"
                value={formState.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="example@mail.com"
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">טלפון</label>
              <input
                type="tel"
                className="form-control"
                value={formState.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="050-0000000"
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">תאריך לידה</label>
              <input
                type="date"
                className="form-control"
                value={formState.birth_date || ''}
                onChange={(e) => updateField('birth_date', e.target.value)}
              />
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label">עיר</label>
              <input
                type="text"
                className="form-control"
                value={formState.city || ''}
                onChange={(e) => updateField('city', e.target.value)}
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label">רחוב</label>
              <input
                type="text"
                className="form-control"
                value={formState.street || ''}
                onChange={(e) => updateField('street', e.target.value)}
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label">מספר בית</label>
              <input
                type="text"
                className="form-control"
                value={formState.home_number || ''}
                onChange={(e) => updateField('home_number', e.target.value)}
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label">מיקוד</label>
              <input
                type="text"
                className="form-control"
                value={formState.postal_code || ''}
                onChange={(e) => updateField('postal_code', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

export default ClientForm;
