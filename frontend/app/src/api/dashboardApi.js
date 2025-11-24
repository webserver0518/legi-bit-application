import { apiClient } from './apiClient';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function fetchOfficeName() {
  const res = await apiClient.get('/get_office_name', {
    headers: { Accept: 'text/plain' },
  });
  const name = typeof res.data === 'string' ? res.data.trim() : '';
  return name || '---';
}

async function fetchUsername() {
  const res = await apiClient.get('/get_username', {
    headers: { Accept: 'text/plain' },
  });
  const name = typeof res.data === 'string' ? res.data.trim() : '';
  return name || '---';
}

async function fetchOfficeCases() {
  const res = await apiClient.get('/get_office_cases');
  return asArray(res.data);
}

async function fetchOfficeClients() {
  const res = await apiClient.get('/get_office_clients');
  return asArray(res.data);
}

async function fetchOfficeFiles() {
  const res = await apiClient.get('/get_office_files');
  return asArray(res.data);
}

async function fetchOfficeUsers() {
  const res = await apiClient.get('/get_office_users');
  return asArray(res.data);
}

export const dashboardApi = {
  fetchOfficeName,
  fetchUsername,
  fetchOfficeCases,
  fetchOfficeClients,
  fetchOfficeFiles,
  fetchOfficeUsers,
};

export default dashboardApi;
