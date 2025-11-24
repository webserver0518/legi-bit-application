import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clientsApi from '../../api/clientsApi';
import ClientForm from '../../components/clients/ClientForm';

function ClientEditPage() {
  const { clientSerial } = useParams();
  const navigate = useNavigate();
  const [initialValues, setInitialValues] = useState(null);
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
        setInitialValues(res);
      } catch (err) {
        setError(err.message || 'טעינת הלקוח נכשלה');
      } finally {
        setLoading(false);
      }
    };

    loadClient();
  }, [clientSerial]);

  const handleSubmit = async (payload) => {
    await clientsApi.updateClient(clientSerial, payload);
    navigate(`/app/clients/${clientSerial}`);
  };

  if (error) {
    return (
      <div className="alert alert-danger" role="alert" dir="rtl">
        {error}
      </div>
    );
  }

  if (loading || !initialValues) {
    return (
      <div className="text-muted" dir="rtl">
        {loading ? 'טוען נתוני לקוח...' : 'לא נמצאו פרטי לקוח'}
      </div>
    );
  }

  return <ClientForm initialValues={initialValues} onSubmit={handleSubmit} mode="edit" />;
}

export default ClientEditPage;
