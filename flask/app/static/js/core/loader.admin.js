/* loader.Admin.js (IIFE, browser globals) */
(function () {
    'use strict';

    if (!window.Core?.storage) {
        throw new Error('AdminLoader: Core.storage must be loaded first');
    }

    const Store = window.Core.storage.create('loader.Admin');
    const KEY = 'current_dashboard_content';

    const runtime = { currentPage: null, currentStyle: null, currentScript: null };

    function container() {
        return (
            document.getElementById('dashboardContent') ||
            document.getElementById('dynamicContent') ||
            document.getElementById('content') ||
            document.body
        );
    }

    const pageMap = {
        offices: "search_office",
    };

    function pathsFor(page) {
        console.log('AdminLoader: pathsFor', page);
        return {
            fetchUrl: `/load_${page}`,
            cssPath: `/static/css/admin_components/${page}.css`,
            jsPath: `/static/js/admin_components/${page}.js`
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
        if (!resp.ok) throw new Error(`adminLoader HTML fetch failed: ${resp.status}`);
        return await resp.text();
    }

    async function loadInternal(page, force) {
        if (typeof force !== 'boolean') throw new Error("adminLoader.load: 'force' must be boolean");
        const cont = container();
        if (!force && runtime.currentPage === page) return { page, changed: false };

        const { fetchUrl, cssPath, jsPath } = pathsFor(page);

        await loadCss(cssPath);

        const html = await fetchHtml(fetchUrl);
        cont.innerHTML = html;

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
        //console.log('AdminLoader: navigate', { linkEl, page, force });
        page = pageMap[page] || page;
        if (typeof force !== 'boolean') throw new Error("AdminLoader.navigate: 'force' must be boolean");
        if (!page && linkEl) page = linkEl.dataset.page;
        if (!page) throw new Error('AdminLoader.navigate: missing page');

        const result = await loadInternal(page, force);

        if (window.Nav?.highlightInSidebar) {
            if (linkEl) {
                const cls = linkEl.closest('.sub-sidebar') ? 'sub-sidebar' : 'sidebar';
                window.Nav.highlightInSidebar(linkEl, cls);
            } else {
                const subLink = document.querySelector(`.sub-sidebar a[data-page="${page}"]`);
                const mainLink = document.querySelector(`.sidebar a[data-page="${page}"]`);
                console.log(subLink, mainLink);
                //console.log({ subLink, mainLink });
                if (subLink) window.Nav.highlightInSidebar(subLink, 'sub-sidebar');
                else if (mainLink) window.Nav.highlightInSidebar(mainLink, 'sidebar');

            }
        }
        if (window.Nav?.setLastPage) window.Nav.setLastPage(page, 'Admin');
        return result;
    }

    window.AdminLoader = {
        load: ({ page, force }) => loadInternal(page, force),
        navigate
    };
})();
