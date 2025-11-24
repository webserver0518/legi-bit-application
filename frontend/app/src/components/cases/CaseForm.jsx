import { useEffect, useMemo, useState } from 'react';

const defaultClient = () => ({
  client_serial: '',
  first_name: '',
  last_name: '',
  role: 'main',
  legal_role: 'prosecutor',
});

function CaseForm({
  initialValues,
  onSubmit,
  categories = [],
  statuses = [],
  mode = 'create',
}) {
  const [formState, setFormState] = useState(() => ({
    title: '',
    field: '',
    facts: '',
    against: '',
    against_type: 'נתבע',
    responsible_serial: '',
    status: 'active',
    clients_with_roles: [defaultClient()],
    ...initialValues,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFormState((prev) => ({
      ...prev,
      ...initialValues,
      clients_with_roles: initialValues?.clients_with_roles?.length
        ? initialValues.clients_with_roles
        : [defaultClient()],
    }));
  }, [initialValues]);

  const hasMainClient = useMemo(
    () => formState.clients_with_roles.some((c) => c.role === 'main'),
    [formState.clients_with_roles],
  );

  const updateField = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const updateClient = (index, key, value) => {
    setFormState((prev) => {
      const next = [...prev.clients_with_roles];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, clients_with_roles: next };
    });
  };

  const addClientRow = () => {
    setFormState((prev) => ({
      ...prev,
      clients_with_roles: [...prev.clients_with_roles, defaultClient()],
    }));
  };

  const removeClientRow = (index) => {
    setFormState((prev) => {
      const next = prev.clients_with_roles.filter((_, i) => i !== index);
      return { ...prev, clients_with_roles: next.length ? next : [defaultClient()] };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formState.title.trim()) {
      setError('יש למלא כותרת לתיק');
      return;
    }

    const hasClientSerials = formState.clients_with_roles.every(
      (client) => `${client.client_serial}`.trim().length > 0,
    );
    if (!hasClientSerials) {
      setError('יש להוסיף מספר מזהה לכל לקוח');
      return;
    }

    if (!hasMainClient) {
      setError('יש להגדיר לקוח ראשי אחד לפחות');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        ...formState,
        clients_with_roles: formState.clients_with_roles.map((c) => ({
          client_serial: c.client_serial,
          role: c.role,
          legal_role: c.legal_role,
        })),
      });
    } catch (err) {
      setError(err.message || 'הפעולה נכשלה');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} dir="rtl">
      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label">כותרת *</label>
          <input
            type="text"
            className="form-control"
            value={formState.title}
            onChange={(e) => updateField('title', e.target.value)}
            required
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label">אחראי</label>
          <input
            type="text"
            className="form-control"
            value={formState.responsible_serial || ''}
            onChange={(e) => updateField('responsible_serial', e.target.value)}
            placeholder="מספר משתמש אחראי"
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label">תחום</label>
          <input
            type="text"
            list="case-categories"
            className="form-control"
            value={formState.field || ''}
            onChange={(e) => updateField('field', e.target.value)}
            placeholder="בחירת תחום"
          />
          <datalist id="case-categories">
            {categories.map((cat) => (
              <option key={cat.value || cat.label} value={cat.label || cat.value}>
                {cat.label || cat.value}
              </option>
            ))}
          </datalist>
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label">נגד מי</label>
          <input
            type="text"
            className="form-control"
            value={formState.against || ''}
            onChange={(e) => updateField('against', e.target.value)}
            placeholder="שם / ח"פ / ארגון"
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label">צד משפטי</label>
          <select
            className="form-select"
            value={formState.against_type || 'נתבע'}
            onChange={(e) => updateField('against_type', e.target.value)}
          >
            <option value="נתבע">נתבע</option>
            <option value="תובע">תובע</option>
          </select>
        </div>

        {mode === 'edit' ? (
          <div className="col-12 col-md-6">
            <label className="form-label">סטטוס</label>
            <select
              className="form-select"
              value={formState.status || 'active'}
              onChange={(e) => updateField('status', e.target.value)}
            >
              {statuses.length ? (
                statuses.map((s) => (
                  <option key={s.value || s} value={s.value || s}>
                    {s.label || s}
                  </option>
                ))
              ) : (
                <>
                  <option value="active">פעיל</option>
                  <option value="archived">סגור</option>
                </>
              )}
            </select>
          </div>
        ) : null}

        <div className="col-12">
          <label className="form-label">מה הסיפור?</label>
          <textarea
            className="form-control"
            rows={4}
            value={formState.facts || ''}
            onChange={(e) => updateField('facts', e.target.value)}
            placeholder="תיאור חופשי"
          />
        </div>
      </div>

      <hr className="my-4" />

      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
        <div>
          <h5 className="mb-0">לקוחות בתיק</h5>
          <small className="text-muted">יש להוסיף לפחות לקוח ראשי אחד</small>
        </div>
        <button type="button" className="btn btn-outline-primary" onClick={addClientRow}>
          ➕ הוסף לקוח
        </button>
      </div>

      <div className="table-responsive">
        <table className="table align-middle text-center">
          <thead className="table-light">
            <tr>
              <th>מס' לקוח</th>
              <th>שם פרטי</th>
              <th>שם משפחה</th>
              <th>ראשי/משני</th>
              <th>תובע/נתבע</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {formState.clients_with_roles.map((client, index) => (
              <tr key={index}>
                <td className="w-25">
                  <input
                    type="text"
                    className="form-control"
                    value={client.client_serial}
                    onChange={(e) => updateClient(index, 'client_serial', e.target.value)}
                    required
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control"
                    value={client.first_name || ''}
                    onChange={(e) => updateClient(index, 'first_name', e.target.value)}
                    placeholder="שם פרטי (לרישום פנימי)"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control"
                    value={client.last_name || ''}
                    onChange={(e) => updateClient(index, 'last_name', e.target.value)}
                    placeholder="שם משפחה"
                  />
                </td>
                <td>
                  <select
                    className="form-select"
                    value={client.role}
                    onChange={(e) => updateClient(index, 'role', e.target.value)}
                  >
                    <option value="main">ראשי</option>
                    <option value="secondary">משני</option>
                  </select>
                </td>
                <td>
                  <select
                    className="form-select"
                    value={client.legal_role}
                    onChange={(e) => updateClient(index, 'legal_role', e.target.value)}
                  >
                    <option value="prosecutor">תובע</option>
                    <option value="defendant">נתבע</option>
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => removeClientRow(index)}
                  >
                    הסר
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="d-flex justify-content-end gap-2 mt-3">
        <button type="submit" className="btn btn-success" disabled={submitting}>
          {submitting ? 'שומר...' : mode === 'edit' ? 'עדכון תיק' : 'פתח תיק חדש'}
        </button>
      </div>
    </form>
  );
}

export default CaseForm;
