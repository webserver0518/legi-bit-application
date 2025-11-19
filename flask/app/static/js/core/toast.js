/* toast.js (IIFE, browser globals) */
(function () {
  'use strict';

  const toast = {};

  function appendToast(el, type) {
    const isSticky = type === 'warning' || type === 'danger';

    const target = isSticky
      ? document.querySelector('#toasts .toast-sticky')
      : document.querySelector('#toasts .toast-normal');

    if (!target) {
      console.error("❌ Toast container missing! Check #toasts setup.");
      return;
    }

    target.appendChild(el);
  }

  function Toast(message, type = 'info', opts = {}) {
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
    appendToast(el, type);

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

  ['info', 'success', 'warning', 'danger', 'primary', 'secondary', 'light', 'dark'].forEach(type => {
    toast[type] = function (message, opts = {}) {
      Toast(message, type, opts);
    };
  });

  window.Toast = toast;
})();



document.addEventListener("DOMContentLoaded", () => {
  if (window.__flash_messages) {
    window.__flash_messages.forEach(([type, message]) => {
      if (window.Toast?.[type]) {
        window.Toast[type](message);
      } else {
        window.Toast.info(message);  // fallback
      }
    });
  }
});