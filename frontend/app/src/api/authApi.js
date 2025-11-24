import apiClient from './apiClient';

const LOGIN_ENDPOINT = '/login';

// NOTE: The Flask application does not currently expose a read-only session route.
// This placeholder assumes a future helper at /auth/session that returns a
// ResponseManager payload { data, error, message, status, success }.
// Adjust the path when the helper is added without changing backend business logic.
const SESSION_ENDPOINT = '/auth/session';

export function getSession() {
  return apiClient.get(SESSION_ENDPOINT);
}

export function login({ username = '', password = '', mfa_code } = {}) {
  const formData = new FormData();
  formData.append('username', username.trim());
  formData.append('password', password.trim());

  if (mfa_code) {
    formData.append('mfa_code', String(mfa_code).trim());
  }

  return apiClient.post(LOGIN_ENDPOINT, formData);
}

export const authApi = {
  login,
  getSession,
};

export default authApi;
