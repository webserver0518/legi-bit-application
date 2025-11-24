const DEFAULT_HEADERS = {
  Accept: 'application/json',
};

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  if (!isJson) {
    const text = await response.text();
    if (!response.ok) {
      const err = new Error(text || 'הבקשה נכשלה.');
      err.name = 'ApiError';
      err.status = response.status;
      err.payload = text;
      throw err;
    }

    return {
      data: text,
      message: null,
      status: response.status,
      success: true,
      payload: text,
    };
  }

  let payload;

  try {
    payload = await response.json();
  } catch (err) {
    const error = new Error('נכשלה קריאת ה-API (לא ניתן היה לקרוא JSON).');
    error.name = 'ApiError';
    error.status = response.status;
    error.payload = null;
    throw error;
  }

  const { data = null, error, message, status, success } = payload || {};
  const isSuccessful = typeof success === 'boolean' ? success : response.ok;

  if (!isSuccessful) {
    const errorMessage = error || message || 'הבקשה נכשלה.';
    const err = new Error(errorMessage);
    err.name = 'ApiError';
    err.status = status ?? response.status;
    err.payload = payload;
    throw err;
  }

  return {
    data,
    message,
    status: status ?? response.status,
    success: isSuccessful,
    payload,
  };
}

function buildHeaders(headers, body) {
  const merged = {
    ...DEFAULT_HEADERS,
    ...headers,
  };

  const hasContentType = Object.keys(merged).some(
    (key) => key.toLowerCase() === 'content-type',
  );

  if (!hasContentType && body && !(body instanceof FormData)) {
    merged['Content-Type'] = 'application/json';
  }

  if (body instanceof FormData && hasContentType) {
    // Avoid forcing a boundary when sending FormData; let the browser set it.
    delete merged['Content-Type'];
  }

  return merged;
}

function normalizeBody(body) {
  if (body === undefined) return undefined;
  if (body instanceof FormData) return body;
  return JSON.stringify(body);
}

async function request(path, options = {}) {
  const { headers = {}, body, method = 'GET', ...rest } = options;
  const preparedBody = normalizeBody(body);

  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: buildHeaders(headers, body),
    body: preparedBody,
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

function patch(path, body, options = {}) {
  return request(path, { ...options, method: 'PATCH', body });
}

function del(path, options = {}) {
  return request(path, { ...options, method: 'DELETE' });
}

export const apiClient = {
  request,
  get,
  post,
  patch,
  del,
  delete: del,
};

export default apiClient;
