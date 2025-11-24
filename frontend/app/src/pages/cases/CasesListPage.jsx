import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import casesApi from '../../api/casesApi';

const statusBadge = {
  active: 'success',
  archived: 'secondary',
};

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('he-IL');
  } catch (e) {
    return value;
  }
}

function getMainClient(caseItem) {
  const expanded = caseItem.clients || caseItem.clients_data || [];
  if (expanded.length) {
    const main = expanded.find((c) => c.role === 'main') || expanded[0];
    return main || {};
  }

  const serialized = caseItem.clients_serials_with_roles || [];
  const [serial] = serialized.find(([, role]) => role === 'main') || serialized[0] || [];
  return { client_serial: serial };
}

function CasesListPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', direction: 'desc' });
  const [statusOptions, setStatusOptions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [casesRes, statusesRes] = await Promise.all([
          casesApi.getOfficeCases({ expand: true }),
          casesApi.getCaseStatuses(),
        ]);
        setCases(Array.isArray(casesRes.data) ? casesRes.data : []);
        setStatusOptions(Array.isArray(statusesRes.data) ? statusesRes.data : []);
      } catch (err) {
        setError(err.message || 'טעינת התיקים נכשלה');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredCases = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...cases]
      .filter((item) => {
        if (statusFilter && item.status !== statusFilter) return false;
        if (fieldFilter && item.field !== fieldFilter) return false;
        if (!term) return true;

        const mainClient = getMainClient(item);
        const values = [
          item.title,
          item.field,
          item.status,
          item.serial,
          mainClient?.first_name,
          mainClient?.last_name,
          mainClient?.client_serial,
          mainClient?.id_card_number,
        ]
          .filter(Boolean)
          .map((v) => `${v}`.toLowerCase());

        return values.some((v) => v.includes(term));
      })
      .sort((a, b) => {
        const dir = sort.direction === 'asc' ? 1 : -1;
        if (sort.key === 'created_at') {
          return dir * (new Date(a.created_at) - new Date(b.created_at));
        }
        const av = `${a[sort.key] ?? ''}`.toLowerCase();
        const bv = `${b[sort.key] ?? ''}`.toLowerCase();
        if (av === bv) return 0;
        return av > bv ? dir : -dir;
      });
  }, [cases, fieldFilter, search, sort.direction, sort.key, statusFilter]);

  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <div className="cases-list" dir="rtl">
      <div className="row g-2 mb-3 align-items-end">
        <div className="col-12 col-md-4">
          <label className="form-label">חיפוש חופשי</label>
          <input
            type="text"
            className="form-control"
            placeholder="חיפוש לפי כותרת, לקוח או מספר"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label">סטטוס</label>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">כל הסטטוסים</option>
            {statusOptions.map((s) => (
              <option key={s.value || s} value={s.value || s}>
                {s.label || s}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label">תחום</label>
          <input
            type="text"
            className="form-control"
            placeholder="סינון לפי תחום"
            value={fieldFilter}
            onChange={(e) => setFieldFilter(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-center py-4">טוען תיקים...</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle text-center">
            <thead className="table-light">
              <tr>
                <th role="button" onClick={() => toggleSort('title')}>
                  כותרת
                </th>
                <th role="button" onClick={() => toggleSort('serial')}>
                  מס' סידורי
                </th>
                <th role="button" onClick={() => toggleSort('field')}>
                  תחום
                </th>
                <th role="button" onClick={() => toggleSort('status')}>
                  סטטוס
                </th>
                <th>לקוח ראשי</th>
                <th>טלפון</th>
                <th>נוצר ע"י</th>
                <th>תאריך יצירה</th>
                <th>מס' קבצים</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-muted py-3">
                    אין תיקים להצגה
                  </td>
                </tr>
              ) : (
                filteredCases.map((caseItem) => {
                  const mainClient = getMainClient(caseItem);
                  return (
                    <tr key={caseItem.serial}>
                      <td className="text-start">{caseItem.title || '-'}</td>
                      <td>{caseItem.serial}</td>
                      <td>{caseItem.field || '-'}</td>
                      <td>
                        <span className={`badge bg-${statusBadge[caseItem.status] || 'secondary'}`}>
                          {caseItem.status || '-'}
                        </span>
                      </td>
                      <td>
                        {mainClient?.first_name || mainClient?.last_name
                          ? `${mainClient.first_name || ''} ${mainClient.last_name || ''}`.trim()
                          : mainClient?.client_serial || '-'}
                      </td>
                      <td>{mainClient?.phone || mainClient?.client_phone || '-'}</td>
                      <td>{caseItem.created_by || caseItem.user_serial || '-'}</td>
                      <td>{formatDate(caseItem.created_at)}</td>
                      <td>{Array.isArray(caseItem.files_serials) ? caseItem.files_serials.length : '-'}</td>
                      <td>
                        <div className="d-flex gap-2 justify-content-center">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => navigate(`/app/cases/${caseItem.serial}`)}
                          >
                            צפייה
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => navigate(`/app/cases/${caseItem.serial}/edit`)}
                          >
                            עריכה
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default CasesListPage;
