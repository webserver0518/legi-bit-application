/* nav.js (IIFE, browser globals) */
(function () {
    'use strict';

    if (!window.Core?.storage) {
        console.warn('Nav: Core.storage not found; last-page persistence disabled');
    }
    const store = window.Core?.storage?.create('navigation');

    const Nav = {};

    Nav.setLastPage = function (page, scope) {
        if (!store) return;
        store.set('lastPage', { page, scope, at: Date.now() });
    };

    Nav.getLastPage = function () {
        if (!store) return null;
        return store.get('lastPage', null);
    };

    Nav.highlightInSidebar = function (linkEl, which = 'sidebar') {
        try {
            const root =
                which === 'sub-sidebar'
                    ? document.querySelector('.sub-sidebar')
                    : document.querySelector('.sidebar');

            if (!root || !linkEl) return;

            root.querySelectorAll('a.active').forEach((a) => a.classList.remove('active'));
            const a = linkEl.tagName === 'A' ? linkEl : linkEl.closest('a');
            if (a) a.classList.add('active');
        } catch (_) { }
    };

    window.Nav = Nav;
})();
