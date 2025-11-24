import apiClient from './apiClient';

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, value);
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

// Set to 'hyphenated' when backend paths adopt the required `file_serial-file_name` convention.
const KEY_STYLE = 'nested';

export function buildObjectKey({
  officeSerial,
  caseSerial,
  fileSerial,
  fileName,
  preferHyphenated = true,
}) {
  const safeFileName = encodeURIComponent(fileName || '').replace(/%20/g, '+');

  if (preferHyphenated && KEY_STYLE === 'hyphenated') {
    return `uploads/${officeSerial}/${caseSerial}/${fileSerial}-${safeFileName}`;
  }

  // Current backend builds a nested path (uploads/{office}/{case}/{file}/{name}).
  return `uploads/${officeSerial}/${caseSerial}/${fileSerial}/${safeFileName}`;
}

export function getOfficeFiles({ caseSerial } = {}) {
  const query = buildQuery({ case_serial: caseSerial });
  return apiClient.get(`/get_office_files${query}`);
}

export function createFile(payload) {
  return apiClient.post('/create_new_file', payload);
}

export function updateFile(fileSerial, payload) {
  const query = buildQuery({ serial: fileSerial });
  return apiClient.patch(`/update_file${query}`, payload);
}

export function updateFileDescription({ fileSerial, description }) {
  return apiClient.post('/update_file_description', {
    file_serial: fileSerial,
    description,
  });
}

export function deleteFile({ caseSerial, fileSerial, fileName }) {
  const query = buildQuery({
    case_serial: caseSerial,
    file_serial: fileSerial,
    file_name: fileName,
  });
  return apiClient.del(`/delete_file${query}`);
}

export function getFileUrl({ caseSerial, fileSerial, fileName }) {
  const query = buildQuery({
    case_serial: caseSerial,
    file_serial: fileSerial,
    file_name: fileName,
  });
  return apiClient.get(`/get_file_url${query}`);
}

export function getPresignedPost(payload) {
  return apiClient.post('/presign/post', payload);
}

export function getOfficeSerial() {
  return apiClient.get('/get_office_serial');
}

const filesApi = {
  buildObjectKey,
  getOfficeFiles,
  createFile,
  updateFile,
  updateFileDescription,
  deleteFile,
  getFileUrl,
  getPresignedPost,
  getOfficeSerial,
};

export default filesApi;
