import apiClient from './apiClient';

// NOTE: The Flask application does not currently expose a read-only session route.
// This placeholder assumes a future helper at /auth/session that returns a
// ResponseManager payload { data, error, message, status, success }.
// Adjust the path when the helper is added without changing backend business logic.
const SESSION_ENDPOINT = '/auth/session';

export function getSession() {
  return apiClient.get(SESSION_ENDPOINT);
}
