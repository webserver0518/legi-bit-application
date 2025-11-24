const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

async function parseResponse(response) {
  let payload;
  try {
    payload = await response.json();
  } catch (err) {
    const error = new Error('נכשלה קריאת ה-API (לא ניתן היה לקרוא JSON).');
    error.status = response.status;
    error.payload = null;
    throw error;
  }

  const { data, error, message, status, success } = payload;
  const isSuccessful = success ?? response.ok;

  if (!isSuccessful) {
    const errorMessage = error || message || 'הבקשה נכשלה.';
    const err = new Error(errorMessage);
    err.status = status ?? response.status;
    err.payload = payload;
    throw err;
  }

  return { data, status: status ?? response.status, message, payload };
}

async function request(path, options = {}) {
  const { headers = {}, body, method = 'GET', ...rest } = options;
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      ...DEFAULT_HEADERS,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });

  return parseResponse(response);
}

function get(path, options = {}) {
  return request(path, { ...options, method: 'GET' });
}

function post(path, body, options = {}) {
  return request(path, { ...options, method: 'POST', body });
}

export const apiClient = {
  request,
  get,
  post,
};

export default apiClient;
