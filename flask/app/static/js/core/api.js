/* api.js (IIFE, browser globals) */
(function () {
    'use strict';

    const API = {};

    async function parseJsonSafe(resp) {
        let payload = null;
        try { payload = await resp.json(); } catch (_) { }
        return payload;
    }

    function normalize(payload, resp) {
        // If server already returns {success,data,error,message} — pass through
        if (payload && typeof payload === 'object' && ('success' in payload)) {
            return {
                success: !!payload.success,
                data: payload.data ?? null,
                error: payload.error ?? null,
                message: payload.message ?? ''
            };
        }
        // Otherwise, derive by HTTP status
        if (resp.ok) {
            return { success: true, data: payload, error: null, message: '' };
        }
        return {
            success: false,
            data: null,
            error: (payload && (payload.error || payload.message)) || `HTTP ${resp.status}`,
            message: (payload && payload.message) || ''
        };
    }

    async function request(url, { method = 'GET', headers = {}, body = undefined } = {}) {
        const init = {
            method,
            credentials: 'same-origin',
            headers: Object.assign({ 'Accept': 'application/json' }, headers)
        };
        if (body !== undefined) {
            // If body is FormData leave as-is, else JSON
            if (body instanceof FormData) {
                init.body = body;
            } else {
                init.headers['Content-Type'] = 'application/json';
                init.body = JSON.stringify(body);
            }
        }
        const resp = await fetch(url, init);
        const payload = await parseJsonSafe(resp);
        return normalize(payload, resp);
    }

    API.getJson = (url) => request(url, { method: 'GET' });
    API.postJson = (url, body) => request(url, { method: 'POST', body });
    API.apiRequest = (url, opts = {}) => request(url, opts);

    window.API = API;
})();
