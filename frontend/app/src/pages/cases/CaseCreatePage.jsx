import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import casesApi from '../../api/casesApi';
import clientsApi from '../../api/clientsApi';
import CaseForm from '../../components/cases/CaseForm';

function CaseCreatePage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMeta = async () => {
      setLoadingMeta(true);
      setError('');
      try {
        const [categoriesRes, clientsRes] = await Promise.all([
          casesApi.getCaseCategories(),
          clientsApi.getOfficeClients(),
        ]);
        setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
        setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      } catch (err) {
        setError(err.message || 'שגיאה בטעינת רשימות עזר');
      } finally {
        setLoadingMeta(false);
      }
    };

    loadMeta();
  }, []);

  const handleSubmit = async (payload) => {
    const response = await casesApi.createCase({
      ...payload,
      created_at: new Date().toISOString(),
    });
    navigate(`/app/cases/${response.data}`);
  };

  return (
    <div dir="rtl">
      {error ? (
        <div className="alert alert-warning" role="alert">
          {error}
        </div>
      ) : null}
      {loadingMeta ? <div className="text-muted mb-2">טוען נתונים...</div> : null}

      <CaseForm onSubmit={handleSubmit} categories={categories} clientsOptions={clients} />
    </div>
  );
}

export default CaseCreatePage;
