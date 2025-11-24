import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import casesApi from '../../api/casesApi';
import CaseForm from '../../components/cases/CaseForm';

function CaseCreatePage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMeta = async () => {
      setLoadingMeta(true);
      setError('');
      try {
        const categoriesRes = await casesApi.getCaseCategories();
        setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
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

      <CaseForm onSubmit={handleSubmit} categories={categories} />
    </div>
  );
}

export default CaseCreatePage;
