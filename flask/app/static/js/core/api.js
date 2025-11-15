/*************************************************
 * core/api.js – Unified HTTP / API layer
 *
 * Goal:
 *  - Single place to handle fetch + JSON parsing.
 *  - Always return the same object shape:
 *      { success, data, error, message, status }
 *
 * This file does NOT depend on DOM or toast.
 * Pages can decide themselves how to show errors.
 **************************************************/

/**
 * Normalize server JSON into a standard shape.
 *
 * Expected server format (recommended):
 *  {
 *    success: boolean,
 *    data: any,
 *    error: string | null,
 *    message: string | null
 *  }
 *
 * If fields are missing – we fallback safely.
 *
 * @param {any} payload
 * @returns {{ success: boolean, data: any, error: string|null, message: string }}
 */
export function parseApiResponse(payload) {
    if (!payload || typeof payload !== 'object') {
        return {
            success: false,
            data: null,
            error: 'Invalid server response',
            message: '',
        };
    }

    const hasSuccess = Object.prototype.hasOwnProperty.call(payload, 'success');

    return {
        success: hasSuccess ? Boolean(payload.success) : false,
        data: Object.prototype.hasOwnProperty.call(payload, 'data')
            ? payload.data
            : null,
        error:
            typeof payload.error === 'string'
                ? payload.error
                : payload.error === null || payload.error === undefined
                    ? null
                    : null,
        message:
            typeof payload.message === 'string'
                ? payload.message
                : payload.message === null || payload.message === undefined
                    ? ''
                    : '',
    };
}

/**
 * Core request function.
 *
 * @param {string} url
 * @param {{
 *   method?: string,
 *   body?: any,
 *   headers?: Record<string, string>,
 *   timeoutMs?: number
 * }} [options]
 *
 * @returns {Promise<{
 *   success: boolean,
 *   data: any,
 *   error: string|null,
 *   message: string,
 *   status: number
 * }>}
 */
export async function apiRequest(url, options = {}) {
    const {
        method = 'GET',
        body = null,
        headers = {},
        timeoutMs = 15000,
    } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    /** @type {RequestInit} */
    const fetchOptions = {
        method,
        headers: { ...headers },
        signal: controller.signal,
    };

    // Handle body (JSON / FormData / string)
    if (body !== null && body !== undefined) {
        if (body instanceof FormData || body instanceof Blob) {
            fetchOptions.body = body;
            // Do NOT set Content-Type – browser will handle it.
        } else if (typeof body === 'string') {
            fetchOptions.body = body;
            if (!('Content-Type' in fetchOptions.headers)) {
                fetchOptions.headers['Content-Type'] = 'application/json';
            }
        } else {
            fetchOptions.body = JSON.stringify(body);
            if (!('Content-Type' in fetchOptions.headers)) {
                fetchOptions.headers['Content-Type'] = 'application/json';
            }
        }
    }

    try {
        const resp = await fetch(url, fetchOptions);
        const status = resp.status;

        // Try to parse JSON – but be tolerant to non-JSON
        let rawPayload = {};
        let text = '';

        try {
            text = await resp.text();
            if (text) {
                try {
                    rawPayload = JSON.parse(text);
                } catch {
                    // Non-JSON body – keep as raw text
                    rawPayload = { raw: text };
                }
            }
        } catch {
            rawPayload = {};
        }

        const parsed = parseApiResponse(rawPayload);

        return {
            ...parsed,
            status,
        };
    } catch (err) {
        // Network / timeout / abort
        const message =
            err && typeof err === 'object' && 'message' in err
                ? String(err.message)
                : 'Network error';

        return {
            success: false,
            data: null,
            error: message,
            message: '',
            status: 0,
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Convenience wrapper for GET requests.
 *
 * @param {string} url
 * @param {{ headers?: Record<string, string>, timeoutMs?: number }} [options]
 */
export function getJson(url, options = {}) {
    return apiRequest(url, { ...options, method: 'GET' });
}

/**
 * Convenience wrapper for POST JSON requests.
 *
 * @param {string} url
 * @param {any} body
 * @param {{ headers?: Record<string, string>, timeoutMs?: number }} [options]
 */
export function postJson(url, body, options = {}) {
    return apiRequest(url, { ...options, method: 'POST', body });
}

/**
 * Convenience wrapper for PUT JSON requests.
 */
export function putJson(url, body, options = {}) {
    return apiRequest(url, { ...options, method: 'PUT', body });
}

/**
 * Convenience wrapper for DELETE requests.
 */
export function deleteJson(url, options = {}) {
    return apiRequest(url, { ...options, method: 'DELETE' });
}

/* Optional default export */
const exported = {
    parseApiResponse,
    apiRequest,
    getJson,
    postJson,
    putJson,
    deleteJson,
};

export default exported;
