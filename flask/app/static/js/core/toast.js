/* toast.js (IIFE, browser globals) */
(function () {
  'use strict';

  function ensureContainer() {
    let wrap = document.querySelector('.toast-wrapper');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrapper position-fixed start-50 translate-middle-x p-3 mb-4';
      wrap.style.zIndex = '9999';
      wrap.style.bottom = '0';
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '10px';
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  function showToast(message, type = 'info', opts = {}) {
    const sticky = !!opts.sticky;
    const timeout = typeof opts.timeout === 'number' ? opts.timeout : 3500;

    const el = document.createElement('div');
    el.className = `toast align-items-center text-white border-0 bg-${type}`;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('aria-atomic', 'true');
    el.style.minWidth = '280px';

    const inner = document.createElement('div');
    inner.className = 'd-flex';
    const body = document.createElement('div');
    body.className = 'toast-body text-center w-100';
    body.textContent = message;

    inner.appendChild(body);

    if (sticky) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-close btn-close-white me-2 m-auto';
      btn.setAttribute('aria-label', 'Close');
      btn.addEventListener('click', () => el.remove());
      inner.appendChild(btn);
    }

    el.appendChild(inner);
    ensureContainer().appendChild(el);

    // Bootstrap Toast support if available
    if (window.bootstrap?.Toast) {
      const t = new window.bootstrap.Toast(el, { autohide: !sticky, delay: timeout });
      t.show();
      if (!sticky) setTimeout(() => el.remove(), timeout + 200);
    } else {
      // Simple fallback
      el.style.opacity = '0';
      el.style.transition = 'opacity .2s ease';
      requestAnimationFrame(() => (el.style.opacity = '1'));
      if (!sticky) {
        setTimeout(() => {
          el.style.opacity = '0';
          setTimeout(() => el.remove(), 220);
        }, timeout);
      }
    }
  }

  window.Toast = { showToast };
  // Convenience alias used across codebase
  window.showToast = showToast;
})();
