/*  core/toast.js  */
import { setText } from './utils.js';

const DEFAULT_DELAY = 5000;

/* --------------------------------------------------------------------------
   resolveTemplate(container)
   --------------------------------------------------------------------------
   Looks inside the given container for a <template data-prototype> element,
   clones it, and extracts the first .toast element within.
   Returns both the cloned fragment and its toast element so it can be
   appended and animated later.
   --------------------------------------------------------------------------

   @param {HTMLElement} container - Parent element holding an optional toast template.
   @returns {{fragment: DocumentFragment, toastEl: HTMLElement}|null}
*/
function resolveTemplate(container) {
  const template = container.querySelector('template[data-prototype]');
  if (!template?.content) return null;
  const fragment = template.content.cloneNode(true);
  const toastEl = fragment.querySelector('.toast') || fragment.firstElementChild;
  return { fragment, toastEl };
}

/* --------------------------------------------------------------------------
   showToast(container, message, type?, opts?)
   --------------------------------------------------------------------------
   Displays a toast message inside the given container.

   - If a <template data-prototype> exists, it clones and reuses its markup.
   - Otherwise it builds a minimal Bootstrap-compatible .toast element.
   - Supports color variants (bg-success, bg-danger, etc.).
   - Works even if Bootstrap JS is not loaded (adds .show manually).

   @param {HTMLElement} container  Parent node where the toast will appear.
   @param {string}      message    Text to display inside the toast.
   @param {string}      [type]     Bootstrap color variant: info|success|danger...
   @param {object}      [opts]     Additional options:
                                   - delay       (number)   Hide delay in ms.
                                   - autohide    (boolean)  Auto-dismiss toggle.
                                   - toastOptions(object)   Extra options for bootstrap.Toast.
   @returns {bootstrap.Toast|HTMLElement|null}
   -------------------------------------------------------------------------- */
export function showToast(message, type = 'info', opts = {}) {
  // ▀▀▀ בחירת קונטיינר אוטומטית ▀▀▀
  let container = document.querySelector(".toast-container.toast-normal");

  if (type === "warning" || type === "danger") {
    container = document.querySelector(".toast-container.toast-sticky");
  }

  if (!container) return null;

  // ✨ Default behavior by type:
  let finalAutohide = opts.autohide;
  let finalDelay = opts.delay;

  if (type === 'success' || type === 'info') {
    finalAutohide = finalAutohide ?? true;
    finalDelay = finalDelay ?? DEFAULT_DELAY;
  } else if (type === 'danger' || type === 'warning') {
    finalAutohide = finalAutohide ?? false; // Sticky
    finalDelay = finalDelay ?? 0;           // Ignored when autohide=false
  }

  const doc = container.ownerDocument || document;
  const delay = finalDelay ?? DEFAULT_DELAY;
  const autohide = finalAutohide ?? true;
  const toastOptions = opts.toastOptions || {};

  let toastEl;
  let fragmentToAppend = null;

  // Try using a <template data-prototype> if provided
  const fromTemplate = resolveTemplate(container);
  if (fromTemplate?.toastEl) {
    toastEl = fromTemplate.toastEl;
    fragmentToAppend = fromTemplate.fragment;
  }

  // Fallback: build a minimal toast element from scratch
  if (!toastEl) {
    toastEl = doc.createElement('div');
    toastEl.className = 'toast align-items-center text-white border-0';
    toastEl.innerHTML = '<div class="d-flex"><div class="toast-body text-center w-100"></div></div>';
  }

  // Accessibility roles
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');

  // Set the message text safely
  const bodyEl = toastEl.querySelector('.toast-body') || toastEl;
  setText(bodyEl, message ?? '');
  // ❌ Add close button if sticky
  if (!autohide) {
    const flex = toastEl.querySelector(".d-flex");

    // remove previous close button if exists
    flex.querySelector(".btn-close")?.remove();

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn-close btn-close-white me-2 m-auto";
    closeBtn.setAttribute("data-bs-dismiss", "toast");
    closeBtn.setAttribute("aria-label", "Close");

    flex.appendChild(closeBtn);
  }

  // Apply the requested color variant
  const typeClasses = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'];
  typeClasses.forEach((cls) => toastEl.classList.remove(`bg-${cls}`));
  if (type) {
    toastEl.classList.add(`bg-${type}`);
  }

  // Append to container (from template or raw)
  if (fragmentToAppend) {
    container.appendChild(fragmentToAppend);
  } else {
    container.appendChild(toastEl);
  }

  const targetToast = fragmentToAppend ? container.lastElementChild : toastEl;

  // Initialize via Bootstrap if available
  const toastInstance = typeof bootstrap !== 'undefined' && bootstrap.Toast
    ? new bootstrap.Toast(targetToast, { autohide, delay, ...toastOptions })
    : null;

  // Auto-remove toast after it’s hidden
  targetToast.addEventListener('hidden.bs.toast', () => targetToast.remove(), { once: true });
  if (toastInstance) {
    toastInstance.show();
    return toastInstance;
  }

  // Fallback if Bootstrap JS is missing
  targetToast.classList.add('show');
  return targetToast;
}

/* --------------------------------------------------------------------------
   Global Exposure (Legacy Compatibility)
   --------------------------------------------------------------------------
   Expose under window.Core.toast for scripts that still rely on globals.
   Future code should import { showToast } instead.
   -------------------------------------------------------------------------- */
if (typeof window !== 'undefined') {
  window.Core = window.Core || {};
  window.Core.toast = { showToast };
}