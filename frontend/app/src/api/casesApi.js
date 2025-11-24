import apiClient from './apiClient';

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && `${item}`.length) {
          searchParams.append(key, item);
        }
      });
      return;
    }

    searchParams.set(key, value);
  });

  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export function getOfficeCases({
  titleTokens,
  clientTokens,
  field,
  status,
  expand = true,
} = {}) {
  const query = buildQuery({
    title_tokens: titleTokens,
    client_tokens: clientTokens,
    field,
    status,
    expand,
  });

  return apiClient.get(`/get_office_cases${query}`);
}

export function getCase(caseSerial, { expand = true } = {}) {
  const query = buildQuery({ serial: caseSerial, expand });
  return apiClient.get(`/get_case${query}`);
}

export function createCase(payload) {
  return apiClient.post('/create_new_case', payload);
}

export function updateCase(caseSerial, payload) {
  const query = buildQuery({ serial: caseSerial });
  return apiClient.patch(`/update_case${query}`, payload);
}

export function updateCaseStatus(caseSerial, status) {
  const query = buildQuery({ serial: caseSerial });
  return apiClient.patch(`/update_case_status${query}`, { status });
}

export function deleteCase(caseSerial) {
  const query = buildQuery({ serial: caseSerial });
  return apiClient.del(`/delete_case${query}`);
}

export function getCaseCategories() {
  return apiClient.get('/get_case_categories');
}

export function getCaseStatuses() {
  return apiClient.get('/get_case_statuses');
}

const casesApi = {
  getOfficeCases,
  getCase,
  createCase,
  updateCase,
  updateCaseStatus,
  deleteCase,
  getCaseCategories,
  getCaseStatuses,
};

export default casesApi;
