/* loader.site.js (IIFE, browser globals) */
(function () {
    'use strict';

    if (!window.Core?.storage) {
        throw new Error('SiteLoader: Core.storage must be loaded first');
    }

    const Store = window.Core.storage.create('loader.site');
    const KEY = 'current_site_content';

    const runtime = { currentPage: null, currentStyle: null, currentScript: null };

    function container() {
        return (
            document.getElementById('dynamicContent') ||
            document.getElementById('content') ||
            document.body
        );
    }

    function pathsFor(page) {
        return {
            fetchUrl: `/load_${page}`,
            cssPath: `/static/css/site_components/${page}.css`,
            jsPath: `/static/js/site_components/${page}.js`
        };
    }

    function loadCss(path) {
        return new Promise((resolve) => {
            if (runtime.currentStyle?.parentNode) runtime.currentStyle.parentNode.removeChild(runtime.currentStyle);
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `${path}?v=${Date.now()}`;
            link.onload = () => resolve(true);
            link.onerror = () => resolve(false);
            document.head.appendChild(link);
            runtime.currentStyle = link;
        });
    }

    function loadJs(path) {
        return new Promise((resolve) => {
            if (runtime.currentScript?.parentNode) runtime.currentScript.parentNode.removeChild(runtime.currentScript);
            const s = document.createElement('script');
            s.type = 'text/javascript';
            s.async = true;
            s.src = `${path}?v=${Date.now()}`;
            s.onload = () => resolve(true);
            s.onerror = () => resolve(false);
            document.body.appendChild(s);
            runtime.currentScript = s;
        });
    }

    async function fetchHtml(url) {
        const resp = await fetch(`${url}?v=${Date.now()}`, { credentials: 'same-origin' });
        if (!resp.ok) throw new Error(`SiteLoader HTML fetch failed: ${resp.status}`);
        return await resp.text();
    }

    async function loadInternal(page, force) {
        if (typeof force !== 'boolean') throw new Error("SiteLoader.load: 'force' must be boolean");
        const cont = container();
        if (!force && runtime.currentPage === page) return { page, changed: false };

        const { fetchUrl, cssPath, jsPath } = pathsFor(page);

        cont.classList.add('exiting');
        const html = await fetchHtml(fetchUrl);
        await loadCss(cssPath);
        cont.innerHTML = html;
        cont.classList.remove('exiting');
        await loadJs(jsPath);

        const initName = `init_${page}`;
        if (typeof window[initName] === 'function') {
            try { await window[initName](); } catch (_) { }
        }

        runtime.currentPage = page;
        Store.set(KEY, page);
        return { page, changed: true };
    }

    async function navigate({ linkEl = null, page = null, force }) {
        if (typeof force !== 'boolean') throw new Error("SiteLoader.navigate: 'force' must be boolean");
        if (!page && linkEl) page = linkEl.dataset.page;
        if (!page) throw new Error('SiteLoader.navigate: missing page');

        const result = await loadInternal(page, force);
        if (window.Nav?.setLastPage) window.Nav.setLastPage(page, 'site');
        return result;
    }

    window.SiteLoader = {
        load: ({ page, force }) => loadInternal(page, force),
        navigate
    };
})();
