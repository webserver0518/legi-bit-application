import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clientsApi from '../../api/clientsApi';

function ClientsListPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadClients = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await clientsApi.getOfficeClients();
        setClients(res.data || []);
      } catch (err) {
        setError(err.message || 'שגיאה בטעינת לקוחות');
      } finally {
        setLoading(false);
      }
    };

    loadClients();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => {
      const values = [
        client.first_name,
        client.last_name,
        client.id_card_number,
        client.phone,
        client.email,
        client.city,
        client.street,
        client.serial,
      ]
        .filter(Boolean)
        .map((v) => `${v}`.toLowerCase());
      return values.some((value) => value.includes(term));
    });
  }, [clients, search]);

  return (
    <section dir="rtl">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h2 className="h4 mb-1">לקוחות</h2>
          <p className="text-muted mb-0">רשימה מפורטת ללא שימוש ב-DataTables.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('new')}>
          ➕ לקוח חדש
        </button>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-12 col-md-6">
          <label className="form-label">חיפוש</label>
          <input
            type="text"
            className="form-control"
            placeholder="חיפוש לפי שם, ת"ז, מייל או טלפון"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-center py-4">טוען לקוחות...</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle text-center">
            <thead className="table-light">
              <tr>
                <th>שם פרטי</th>
                <th>שם משפחה</th>
                <th>ת"ז</th>
                <th>עיר</th>
                <th>רחוב</th>
                <th>מספר בית</th>
                <th>מיקוד</th>
                <th>אימייל</th>
                <th>טלפון</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-muted py-3">
                    אין לקוחות להצגה
                  </td>
                </tr>
              ) : (
                filtered.map((client) => (
                  <tr key={client.serial || client.id_card_number}>
                    <td>{client.first_name || '-'}</td>
                    <td>{client.last_name || '-'}</td>
                    <td>{client.id_card_number || '-'}</td>
                    <td>{client.city || '-'}</td>
                    <td>{client.street || '-'}</td>
                    <td>{client.home_number || '-'}</td>
                    <td>{client.postal_code || '-'}</td>
                    <td>{client.email || '-'}</td>
                    <td>{client.phone || '-'}</td>
                    <td>
                      <div className="d-flex gap-2 justify-content-center">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => navigate(`${client.serial}`)}
                        >
                          צפייה
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => navigate(`${client.serial}/edit`)}
                        >
                          עריכה
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default ClientsListPage;
