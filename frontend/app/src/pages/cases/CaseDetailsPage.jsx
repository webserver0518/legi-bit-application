import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import casesApi from '../../api/casesApi';

const statusBadge = {
  active: 'success',
  archived: 'secondary',
};

function CaseDetailsPage() {
  const { caseSerial } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    const fetchCase = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await casesApi.getCase(caseSerial, { expand: true });
        setCaseData(res.data);
      } catch (err) {
        setError(err.message || 'שגיאה בטעינת התיק');
      } finally {
        setLoading(false);
      }
    };

    fetchCase();
  }, [caseSerial]);

  const handleDelete = async () => {
    if (!window.confirm('האם למחוק את התיק לצמיתות?')) return;
    setActionMessage('');
    try {
      await casesApi.deleteCase(caseSerial);
      setActionMessage('התיק נמחק בהצלחה');
      navigate('/app/cases');
    } catch (err) {
      setError(err.message || 'מחיקת התיק נכשלה');
    }
  };

  if (loading) {
    return <div className="text-center py-4">טוען נתוני תיק...</div>;
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (!caseData) return null;

  const mainClient = (caseData.clients || caseData.clients_data || []).find(
    (c) => c.role === 'main',
  );
  const clients = caseData.clients || caseData.clients_data || [];

  return (
    <div className="case-details" dir="rtl">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h3 className="mb-1">{caseData.title}</h3>
          <div className="text-muted">מס' תיק: {caseData.serial}</div>
        </div>
        <div className="d-flex gap-2">
          <span className={`badge fs-6 align-self-center bg-${statusBadge[caseData.status] || 'secondary'}`}>
            {caseData.status}
          </span>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate(`/app/cases/${caseSerial}/edit`)}
          >
            עריכה
          </button>
          <button type="button" className="btn btn-outline-danger" onClick={handleDelete}>
            מחיקה
          </button>
        </div>
      </div>

      {actionMessage ? (
        <div className="alert alert-success" role="alert">
          {actionMessage}
        </div>
      ) : null}

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-3">
          <div className="p-3 bg-light rounded h-100">
            <div className="text-muted">נוצר ע"י</div>
            <div className="fw-semibold">{caseData.created_by || caseData.user_serial || '-'}</div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="p-3 bg-light rounded h-100">
            <div className="text-muted">אחראי</div>
            <div className="fw-semibold">{caseData.responsible_serial || '-'}</div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="p-3 bg-light rounded h-100">
            <div className="text-muted">תחום</div>
            <div className="fw-semibold">{caseData.field || '-'}</div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="p-3 bg-light rounded h-100">
            <div className="text-muted">נגד</div>
            <div className="fw-semibold">{caseData.against || '-'}</div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h5 className="mb-2">מה הסיפור?</h5>
        <div className="bg-white border rounded p-3" dir="rtl">
          {caseData.facts || 'לא סופק תיאור'}
        </div>
      </div>

      <div className="mb-4">
        <h5 className="mb-2">לקוחות</h5>
        <div className="table-responsive">
          <table className="table align-middle text-center">
            <thead className="table-light">
              <tr>
                <th>שם</th>
                <th>מספר</th>
                <th>תפקיד</th>
                <th>צד משפטי</th>
                <th>טלפון</th>
                <th>דוא"ל</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted py-3">
                    אין לקוחות להצגה
                  </td>
                </tr>
              ) : (
                clients.map((client, idx) => (
                  <tr key={client.serial || idx}>
                    <td className="text-start">
                      {[client.first_name, client.last_name].filter(Boolean).join(' ') || '-'}
                      {client.role === 'main' ? ' (ראשי)' : ''}
                    </td>
                    <td>{client.serial || client.client_serial || '-'}</td>
                    <td>{client.role || '-'}</td>
                    <td>{client.legal_role || '-'}</td>
                    <td>{client.phone || '-'}</td>
                    <td>{client.email || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-3">
        <h6 className="text-muted mb-1">לקוח ראשי</h6>
        <div className="border rounded p-3 bg-light">
          {mainClient
            ? `${mainClient.first_name || ''} ${mainClient.last_name || ''} (מס' ${
                mainClient.serial || mainClient.client_serial || '-'
              })`
            : 'לא הוגדר לקוח ראשי'}
        </div>
      </div>
    </div>
  );
}

export default CaseDetailsPage;
