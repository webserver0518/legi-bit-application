import { apiClient } from './apiClient';

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

async function getRolesList() {
  const res = await apiClient.get('/get_roles_list');
  return toArray(res.data);
}

async function getOfficeName() {
  const res = await apiClient.get('/get_office_name', {
    headers: { Accept: 'text/plain' },
  });
  const name = typeof res.data === 'string' ? res.data.trim() : '';
  return name || '';
}

async function getOfficeSerial() {
  const res = await apiClient.get('/get_office_serial');
  return res.data?.office_serial || '';
}

async function getOfficeUsers() {
  const res = await apiClient.get('/get_office_users');
  return toArray(res.data);
}

function buildUserFormData(action, payload = {}) {
  const fd = new FormData();
  fd.append('action', action);

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === 'roles') {
      toArray(value).forEach((role) => fd.append('roles[]', role));
      return;
    }
    if (typeof value === 'string' && value.trim() === '') return;
    fd.append(key, value);
  });

  return fd;
}

async function addUser({ username, password, email, officeName, roles }) {
  const fd = buildUserFormData('add', {
    username,
    password,
    email,
    office_name: officeName,
    roles,
  });
  return apiClient.post('/manage_user', fd);
}

async function editUser({ username, officeSerial, password, email, roles }) {
  const fd = buildUserFormData('edit', {
    username,
    office_serial: officeSerial,
    password,
    email,
    roles,
  });
  return apiClient.post('/manage_user', fd);
}

async function deleteUser({ username, officeSerial }) {
  const fd = buildUserFormData('delete', {
    username,
    office_serial: officeSerial,
  });
  return apiClient.post('/manage_user', fd);
}

export const adminApi = {
  getRolesList,
  getOfficeName,
  getOfficeSerial,
  getOfficeUsers,
  addUser,
  editUser,
  deleteUser,
};

export default adminApi;
