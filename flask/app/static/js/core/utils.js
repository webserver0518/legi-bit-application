/*  core/utils.js  */

const doc = typeof document !== 'undefined' ? document : null;

/* --------------------------------------------------------------------------
   Query Selectors
   -------------------------------------------------------------------------- */

/**
 * Shortcut for document.querySelector().
 * Returns the first matching element inside a given scope.
 * Safely returns null if selector or document is missing.
 */
export function qs(selector, scope = doc) {
  if (!selector || !scope) return null;
  return scope.querySelector(selector);
}

/**
 * Shortcut for document.querySelectorAll().
 * Returns an array (not NodeList) of matching elements inside a given scope.
 * Safely returns [] if selector or document is missing.
 */
export function qsa(selector, scope = doc) {
  if (!selector || !scope) return [];
  return Array.from(scope.querySelectorAll(selector));
}

/* --------------------------------------------------------------------------
   Event Helpers
   -------------------------------------------------------------------------- */

/**
 * Attaches an event listener safely and returns a cleanup function
 * to remove it later. Guards against invalid targets.
 *
 * Example:
 *   const off = on(window, 'resize', handleResize);
 *   off(); // remove listener
 */
export function on(target, eventName, handler, options) {
  if (!target || typeof target.addEventListener !== 'function') return () => {};
  target.addEventListener(eventName, handler, options);
  return () => target.removeEventListener(eventName, handler, options);
}

/**
 * Event delegation helper.
 * Listens for an event on a parent (root) element and triggers handler
 * when the event’s target or one of its ancestors matches the selector.
 * Returns a cleanup function to unbind the listener.
 *
 * Example:
 *   delegate(table, 'click', '[data-action="delete"]', (e, btn) => {...});
 */
export function delegate(root, eventName, selector, handler, options) {
  if (!root || typeof root.addEventListener !== 'function') return () => {};
  const listener = (event) => {
    const match = event.target?.closest(selector);
    if (match && root.contains(match)) {
      handler(event, match);
    }
  };
  root.addEventListener(eventName, listener, options);
  return () => root.removeEventListener(eventName, listener, options);
}

/* --------------------------------------------------------------------------
   Content Safety
   -------------------------------------------------------------------------- */

/**
 * Escapes a string for safe HTML insertion.
 * Converts <, >, &, " and other characters to HTML entities.
 * Prevents XSS when inserting user-provided text into innerHTML.
 */
export function escapeHTML(value = '') {
  if (!doc) return String(value ?? '');
  const el = doc.createElement('div');
  el.textContent = String(value ?? '');
  return el.innerHTML;
}

/**
 * Safely sets textContent of an element.
 * Ignores null elements and undefined text.
 */
export function setText(el, text = '') {
  if (!el) return;
  el.textContent = text ?? '';
}

/**
 * Converts an HTML string into a DocumentFragment.
 * Useful for safely constructing elements before appending to DOM.
 * Avoids direct use of innerHTML for complex templates.
 */
export function htmlToFragment(html) {
  if (!doc) return null;
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, 'text/html');
  const fragment = doc.createDocumentFragment();
  Array.from(parsed.body.childNodes).forEach((node) => fragment.appendChild(node));
  return fragment;
}

/* --------------------------------------------------------------------------
   Global Exposure (Legacy Compatibility)
   -------------------------------------------------------------------------- */

/**
 * Expose the utils under window.Core.utils for scripts
 * that still rely on globals (until full ES module migration).
 */
if (typeof window !== 'undefined') {
  window.Core = window.Core || {};
  window.Core.utils = { qs, qsa, on, delegate, escapeHTML, setText, htmlToFragment };
}