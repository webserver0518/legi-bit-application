/*************************************************
 * core/utils.js – Shared front-end utilities
 *
 * This file is loaded as an ES module:
 *   import('/static/js/core/utils.js')
 *
 * All functions are exported as named exports,
 * and also collected in a default export object.
 *
 * IMPORTANT:
 *  - Keep functions small and pure when possible.
 *  - Do NOT rely on global state here.
 **************************************************/

/* -------------------------
 * DOM HELPERS
 * ------------------------- */

/**
 * Safe querySelector.
 * @param {string} selector
 * @param {ParentNode} [scope=document]
 * @returns {Element|null}
 */
export function qs(selector, scope = document) {
  if (!selector || !scope?.querySelector) return null;
  return scope.querySelector(selector);
}

/**
 * Safe querySelectorAll → always returns an array.
 * @param {string} selector
 * @param {ParentNode} [scope=document]
 * @returns {Element[]}
 */
export function qsa(selector, scope = document) {
  if (!selector || !scope?.querySelectorAll) return [];
  return Array.from(scope.querySelectorAll(selector));
}

/**
 * Event delegation helper.
 * @param {Element|Document} root
 * @param {string} eventName
 * @param {string} selector
 * @param {(event: Event, match: Element) => void} handler
 * @param {boolean|AddEventListenerOptions} [options]
 * @returns {() => void} unsubscribe function
 */
export function delegate(root, eventName, selector, handler, options) {
  if (!root?.addEventListener) return () => { };

  const listener = (event) => {
    const target = /** @type {Element|null} */ (event.target);
    if (!target?.closest) return;

    const match = target.closest(selector);
    if (match && root.contains(match)) {
      handler(event, match);
    }
  };

  root.addEventListener(eventName, listener, options);
  return () => root.removeEventListener(eventName, listener, options);
}

/**
 * Safely set textContent on an element.
 * If element is null – does nothing.
 * @param {Element|null} el
 * @param {string} [text='']
 */
export function setText(el, text = '') {
  if (!el) return;
  // support null/undefined gracefully
  el.textContent = text ?? '';
}

/**
 * Convert an HTML string into a DocumentFragment.
 * If html is empty → returns an empty fragment.
 * @param {string} html
 * @returns {DocumentFragment}
 */
export function htmlToFragment(html) {
  if (typeof document === 'undefined') {
    // In non-browser environments, just return an empty fragment
    return {
      childNodes: [],
    };
  }

  const template = document.createElement('template');
  template.innerHTML = html || '';
  return template.content;
}

/* -------------------------
 * VALUE HELPERS
 * ------------------------- */

/**
 * Ensure a display-safe value.
 * - If value is a non-empty string → trimmed string.
 * - If value is null/undefined/empty string → fallback ("-").
 * - For non-string values → returns as-is (0, numbers, etc.).
 *
 * @param {any} value
 * @param {string} [fallback="-"]
 * @returns {string|any}
 */
export function safeValue(value, fallback = '-') {
  if (value === null || value === undefined) return fallback;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? fallback : trimmed;
  }

  return value;
}

/* -------------------------
 * FILE / MIME HELPERS
 * ------------------------- */

/**
 * Remove the last extension from a file name.
 * "document.pdf" → "document"
 * "archive.tar.gz" → "archive.tar"
 *
 * @param {string} filename
 * @returns {string}
 */
export function removeExtension(filename) {
  if (!filename || typeof filename !== 'string') return filename;
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(0, lastDot) : filename;
}

/**
 * Map a MIME type to an icon path.
 * The icons directory is shared across the app.
 *
 * @param {string} mime
 * @returns {string} icon path
 */
export function fileIconPath(mime) {
  if (!mime || typeof mime !== 'string') {
    return '/static/images/icons/GENERIC.svg';
  }

  const lower = mime.toLowerCase();

  if (lower === 'application/pdf') {
    return '/static/images/icons/PDF.svg';
  }
  if (lower.includes('word')) {
    return '/static/images/icons/WORD.svg';
  }
  if (lower.includes('excel') || lower.includes('spreadsheet')) {
    return '/static/images/icons/EXCEL.svg';
  }
  if (lower.startsWith('image/')) {
    return '/static/images/icons/IMAGE.svg';
  }
  if (lower.startsWith('video/')) {
    return '/static/images/icons/VIDEO.svg';
  }
  if (lower.startsWith('audio/')) {
    return '/static/images/icons/AUDIO.svg';
  }
  if (
    lower.includes('zip') ||
    lower.includes('rar') ||
    lower.includes('7z')
  ) {
    return '/static/images/icons/ARCHIVE.svg';
  }

  return '/static/images/icons/GENERIC.svg';
}

/* -------------------------
 * DATE / TIME HELPERS
 * ------------------------- */

/**
 * Build a local ISO-like timestamp with timezone offset WITHOUT seconds.
 * Example: "2025-11-15T18:32+02:00"
 *
 * This is equivalent to what you already do in add_case.js
 * (year-month-day T hour:minute + offset).
 *
 * @returns {string}
 */
export function buildLocalTimestamp() {
  const now = new Date();
  const tzOffsetMinutes = -now.getTimezoneOffset(); // minutes from UTC
  const sign = tzOffsetMinutes >= 0 ? '+' : '-';

  const pad2 = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');

  const offsetHours = pad2(tzOffsetMinutes / 60);
  const offsetMins = pad2(tzOffsetMinutes % 60);

  const year = now.getFullYear();
  const month = pad2(now.getMonth() + 1);
  const day = pad2(now.getDate());
  const hours = pad2(now.getHours());
  const minutes = pad2(now.getMinutes());

  return (
    year +
    '-' +
    month +
    '-' +
    day +
    'T' +
    hours +
    ':' +
    minutes +
    sign +
    offsetHours +
    ':' +
    offsetMins
  );
}

/* -------------------------
 * DEFAULT EXPORT (optional)
 * ------------------------- */

const exported = {
  qs,
  qsa,
  delegate,
  setText,
  htmlToFragment,
  safeValue,
  removeExtension,
  fileIconPath,
  buildLocalTimestamp,
};

export default exported;
