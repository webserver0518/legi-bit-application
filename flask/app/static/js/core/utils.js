/* utils.js (IIFE, browser globals) */
(function () {
  'use strict';

  const utils = {};

  // DOM helpers
  utils.qs = (sel, root = document) => root.querySelector(sel);
  utils.qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  utils.setText = (elOrSelector, text) => {
    const el = typeof elOrSelector === 'string' ? utils.qs(elOrSelector) : elOrSelector;
    if (el) el.textContent = text != null ? String(text) : '';
  };

  // Event delegation
  utils.delegate = (rootEl, event, selector, handler) => {
    const root = typeof rootEl === 'string' ? utils.qs(rootEl) : rootEl;
    if (!root) return;
    root.addEventListener(event, (e) => {
      const match = e.target.closest(selector);
      if (match && root.contains(match)) {
        handler(e, match);
      }
    });
  };

  // Safe string helpers
  utils.safeValue = (v) => {
    if (v == null) return '-';
    if (typeof v === 'string') {
      const t = v.trim();
      return t === '' ? '-' : t;
    }
    return String(v);
  };

  utils.removeExtension = (filename) => {
    if (!filename || typeof filename !== 'string') return filename;
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(0, lastDot) : filename;
  };

  utils.fileIconPath = (mime = '') => {
    const m = String(mime || '').toLowerCase();
    if (m === 'application/pdf') return '/static/images/icons/PDF.svg';
    if (m.includes('word')) return '/static/images/icons/WORD.svg';
    if (m.includes('excel') || m.includes('spreadsheet')) return '/static/images/icons/EXCEL.svg';
    if (m.startsWith('image/')) return '/static/images/icons/IMAGE.svg';
    if (m.startsWith('video/')) return '/static/images/icons/VIDEO.svg';
    if (m.startsWith('audio/')) return '/static/images/icons/AUDIO.svg';
    if (m.includes('zip') || m.includes('rar') || m.includes('7z')) return '/static/images/icons/ARCHIVE.svg';
    return '/static/images/icons/GENERIC.svg';
  };

  // Time
  utils.buildLocalTimestamp = () => {
    try {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch (_) {
      return new Date().toISOString();
    }
  };

  window.utils = utils;
})();
