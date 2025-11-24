import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clientsApi from '../../api/clientsApi';

function ClientDetailsPage() {
  const { clientSerial } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadClient = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await clientsApi.getClientBySerial(clientSerial);
        if (!res) {
          setError('לקוח לא נמצא');
          return;
        }
        setClient(res);
      } catch (err) {
        setError(err.message || 'שגיאה בטעינת הלקוח');
      } finally {
        setLoading(false);
      }
    };

    loadClient();
  }, [clientSerial]);

  if (error) {
    return (
      <div className="alert alert-danger" role="alert" dir="rtl">
        {error}
      </div>
    );
  }

  if (loading || !client) {
    return (
      <div className="text-muted" dir="rtl">
        {loading ? 'טוען פרטי לקוח...' : 'לא נמצאו פרטי לקוח'}
      </div>
    );
  }

  return (
    <section dir="rtl">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h2 className="h4 mb-1">{client.first_name} {client.last_name}</h2>
          <p className="text-muted mb-0">מספר לקוח: {client.serial || '-'}</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>
            חזרה
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/app/clients/${client.serial}/edit`)}
          >
            עריכה
          </button>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-md-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h5 className="card-title">פרטים אישיים</h5>
              <dl className="row mb-0">
                <dt className="col-4">שם פרטי</dt>
                <dd className="col-8">{client.first_name || '-'}</dd>
                <dt className="col-4">שם משפחה</dt>
                <dd className="col-8">{client.last_name || '-'}</dd>
                <dt className="col-4">ת"ז</dt>
                <dd className="col-8">{client.id_card_number || '-'}</dd>
                <dt className="col-4">תאריך לידה</dt>
                <dd className="col-8">{client.birth_date || '-'}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h5 className="card-title">פרטי התקשרות</h5>
              <dl className="row mb-0">
                <dt className="col-4">אימייל</dt>
                <dd className="col-8">{client.email || '-'}</dd>
                <dt className="col-4">טלפון</dt>
                <dd className="col-8">{client.phone || '-'}</dd>
                <dt className="col-4">עיר</dt>
                <dd className="col-8">{client.city || '-'}</dd>
                <dt className="col-4">רחוב</dt>
                <dd className="col-8">{client.street || '-'}</dd>
                <dt className="col-4">מספר בית</dt>
                <dd className="col-8">{client.home_number || '-'}</dd>
                <dt className="col-4">מיקוד</dt>
                <dd className="col-8">{client.postal_code || '-'}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm mt-3">
        <div className="card-body">
          <h5 className="card-title">קשר לתיקים</h5>
          <p className="text-muted mb-0">
            TBD: מיפוי תיקים ללקוח באמצעות clients_with_roles או חיתוך API קיים.
          </p>
        </div>
      </div>
    </section>
  );
}

export default ClientDetailsPage;
