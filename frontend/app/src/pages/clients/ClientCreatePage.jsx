import { useNavigate } from 'react-router-dom';
import clientsApi from '../../api/clientsApi';
import ClientForm from '../../components/clients/ClientForm';

function ClientCreatePage() {
  const navigate = useNavigate();

  const handleSubmit = async (payload) => {
    const response = await clientsApi.createClient({
      ...payload,
      created_at: new Date().toISOString(),
    });
    const serial = response.data;
    navigate(`/app/clients/${serial}`);
  };

  return (
    <ClientForm
      onSubmit={handleSubmit}
      mode="create"
    />
  );
}

export default ClientCreatePage;
