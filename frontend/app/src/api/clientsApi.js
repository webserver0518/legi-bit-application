import apiClient from './apiClient';

function mapClientPayload(client) {
  if (!client) return {};
  const normalized = client.clients || client;
  return {
    serial: normalized.serial ?? normalized.client_serial,
    first_name: normalized.first_name || '',
    last_name: normalized.last_name || '',
    id_card_number: normalized.id_card_number || '',
    phone: normalized.phone || '',
    email: normalized.email || '',
    city: normalized.city || '',
    street: normalized.street || '',
    home_number: normalized.home_number || '',
    postal_code: normalized.postal_code || '',
    birth_date: normalized.birth_date || '',
    created_at: normalized.created_at || '',
    status: normalized.status || '',
  };
}

async function getOfficeClients() {
  const res = await apiClient.get('/get_office_clients');
  const list = Array.isArray(res.data) ? res.data : [];
  return {
    ...res,
    data: list.map(mapClientPayload),
    raw: res.data,
  };
}

async function createClient(payload) {
  return apiClient.post('/create_new_client', payload);
}

async function updateClient(serial, payload) {
  const query = new URLSearchParams({ serial });
  return apiClient.patch(`/update_client?${query.toString()}`, payload);
}

async function getClientBySerial(serial) {
  if (!serial) return null;
  const res = await getOfficeClients();
  const match = res.data.find(
    (client) => `${client.serial}` === `${serial}` || `${client.client_serial}` === `${serial}`,
  );
  return match || null;
}

const clientsApi = {
  getOfficeClients,
  createClient,
  updateClient,
  getClientBySerial,
};

export default clientsApi;
