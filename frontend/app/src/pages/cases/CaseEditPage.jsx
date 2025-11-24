import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import casesApi from '../../api/casesApi';
import clientsApi from '../../api/clientsApi';
import CaseForm from '../../components/cases/CaseForm';

function CaseEditPage() {
  const { caseSerial } = useParams();
  const navigate = useNavigate();
  const [initialValues, setInitialValues] = useState(null);
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [caseRes, catRes, statusRes, clientsRes] = await Promise.all([
          casesApi.getCase(caseSerial, { expand: true }),
          casesApi.getCaseCategories(),
          casesApi.getCaseStatuses(),
          clientsApi.getOfficeClients(),
        ]);

        const current = caseRes.data || {};
        const clients = Array.isArray(current.clients_serials_with_roles)
          ? current.clients_serials_with_roles.map((entry) => ({
              client_serial: entry[0],
              role: entry[1],
              legal_role: entry[2],
            }))
          : [];

        setInitialValues({
          title: current.title || '',
          field: current.field || '',
          facts: current.facts || '',
          against: current.against || '',
          against_type: current.against_type || 'נתבע',
          responsible_serial: current.responsible_serial || '',
          status: current.status || 'active',
          clients_with_roles: clients,
        });
        setCategories(Array.isArray(catRes.data) ? catRes.data : []);
        setStatuses(Array.isArray(statusRes.data) ? statusRes.data : []);
        setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      } catch (err) {
        setError(err.message || 'שגיאה בטעינת נתוני התיק');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [caseSerial]);

  const handleSubmit = async (payload) => {
    const baseUpdate = {
      title: payload.title,
      field: payload.field,
      facts: payload.facts,
      against: payload.against,
      against_type: payload.against_type,
      responsible_serial: payload.responsible_serial,
      clients_serials_with_roles: payload.clients_with_roles.map((c) => [
        `${c.client_serial}`,
        c.role,
        c.legal_role,
      ]),
    };

    await casesApi.updateCase(caseSerial, baseUpdate);
    if (payload.status && payload.status !== initialValues?.status) {
      await casesApi.updateCaseStatus(caseSerial, payload.status);
    }

    navigate(`/app/cases/${caseSerial}`);
  };

  const loadingText = useMemo(() => {
    if (loading) return 'טוען פרטי תיק...';
    if (initialValues) return '';
    return 'לא נמצאו פרטי תיק';
  }, [initialValues, loading]);

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (loading || !initialValues) {
    return <div className="text-muted">{loadingText}</div>;
  }

  return (
    <CaseForm
      initialValues={initialValues}
      onSubmit={handleSubmit}
      categories={categories}
      statuses={statuses}
      clientsOptions={clients}
      mode="edit"
    />
  );
}

export default CaseEditPage;
