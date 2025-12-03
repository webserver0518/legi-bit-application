/* window.utils.js (IIFE, browser globals) */
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

  // DOM Ready helper
  utils.waitForDom = async () => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') return;
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
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

    const enToHe = {
      "invoice": "חשבונית",
      "case": "תיק",
      "client": "לקוח",
      "file": "קובץ",
      "document": "מסמך",
      "active": "פעיל",
      "inactive": "לא פעיל",
      "open": "פתוח",
      "closed": "סגור",
      "prosecutor": "תובע",
      "defendant": "נתבע",
      "main": "ראשי",
      "secondary": "משני",
      "appendix": "נספח",
    };


    if (typeof v === 'string') {
      const t = v.trim();
      if (t === '') return '-';

      const key = t.toLowerCase();

      if (enToHe[key]) return enToHe[key];
      else return t;
    }
    return String(v);
  };

  utils.removeExtension = (filename) => {
    if (!filename || typeof filename !== 'string') return filename;
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(0, lastDot) : filename;
  };

  // === File icon by filename (shared) ===
  utils.getFileIconHTML = function (filename, size = 18) {
    const name = String(filename || '').toLowerCase();

    const byExt = (exts, icon) => exts.some(ex => name.endsWith("." + ex)) && icon;

    const icon =
      byExt(["pdf"], "PDF") ||
      byExt(["doc", "docx", "rtf"], "WORD") ||
      byExt(["xls", "xlsx", "csv"], "EXCEL") ||
      byExt(["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "svg"], "IMAGE") ||
      byExt(["mp4", "mov", "avi", "mkv", "webm", "m4v"], "VIDEO") ||
      byExt(["mp3", "m4a", "wav", "ogg", "flac"], "AUDIO") ||
      byExt(["zip", "rar", "7z", "tar", "gz", "bz2"], "ARCHIVE") ||
      "GENERIC";

    const src = `/static/images/icons/${icon}.svg`;
    const s = Number(size) || 18;
    return `<img src="${src}" alt="" style="width:${s}px;height:${s}px;vertical-align:-3px;">`;
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
