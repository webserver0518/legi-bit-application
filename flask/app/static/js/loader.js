/*************************************************
*          loader.js –  Universal SPA Loader     *
*   שימוש:  Loader.loadPage(opts)               *
**************************************************/


/* =====  Storage Abstraction  ===== */
const store = sessionStorage;           // החלף ל-localStorage אם תרצה שוב קבע
const S = {                         // קיצור נוח
  set: (k, v) => store.setItem(k, v),
  get: k => store.getItem(k),
  del: k => store.removeItem(k),
};

const current_site_content = 'current_site_content';
const current_dashboard_content = 'current_dashboard_content';
const current_sub_sidebar = 'current_sub_sidebar';


/* ניווט מהתפריט */
function navigateTo(linkEl, force=false) {
  loadContent(
    page = linkEl.dataset.page,
    force = force,
    type = linkEl.dataset.type
  );
  highlightInSidebar(linkEl, 'sub-sidebar');
}

/* טעינת דף */
function loadContent(page, force, type) {
  let cureentContent;
  if (type == 'site'){
    cureentContent = current_site_content;
  }else if (type == 'admin' || type == 'user'){
    cureentContent = current_dashboard_content;
  }
  
  if (!page || page === S.get(cureentContent) && !force) return;
  S.set(cureentContent, page);
  let folderName = type + "_components";

  Loader.loadPage({
    pageID: page,
    fetchUrl: `/load_${page}`,
    cssPath: `/static/css/${folderName}/${page}.css`,
    jsPath: `/static/js/${folderName}/${page}.js`,
    container: document.getElementById('dynamicContent'),
    forceState: force
  });
}


const Loader = (() => {
  /* מצב גלובלי */
  let currentPage = null;
  let currentStyle = null;
  let currentScript = null;

  /* טעינת CSS – מחכה לסיום כדי למנוע FOUC */
  function loadCss(path) {
    return new Promise(resolve => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${path}?v=${Date.now()}`;          // BYPASS-CACHE
      link.id = 'dynamic-style';
      link.onload = () => resolve(link);
      link.onerror = () => { link.remove(); resolve(null); };
      document.head.appendChild(link);
    });
  }

  /* טעינת JS – לא חוסם UI */
  function loadJs(path, pageID) {
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = `${path}?v=${Date.now()}`;          // BYPASS-CACHE
      s.id = 'dynamic-script';
      s.onload = () => {
        const initFn = `init_${pageID}`;
        if (typeof window[initFn] === 'function') window[initFn]();
        resolve(s);
      };
      s.onerror = () => { s.remove(); resolve(null); };
      document.body.appendChild(s);
    });
  }

  /* API ראשי */
  async function loadPage({ pageID, fetchUrl, cssPath, jsPath, container, forceState = false }) 
  {
    if (pageID === currentPage && !forceState) return;

    /* 1. HTML */
    const html = await fetch(`${fetchUrl}?v=${Date.now()}`)
      .then(r => { if (!r.ok) throw new Error(`loading error: ${r.status}`); return r.text(); });

    /* 2. CSS */
    const newStyle = await loadCss(cssPath);

    /* 3. החלפת תוכן – אחרי CSS */
    container.style.opacity = 0;
    container.innerHTML = html;
    requestAnimationFrame(() => (container.style.opacity = 1));

    /* 4. JS */
    const newScript = await loadJs(jsPath, pageID);

    /* 5. ניקוי קודמים */
    currentStyle?.remove();
    currentScript?.remove();
    if (newStyle) currentStyle = newStyle;
    if (newScript) currentScript = newScript;
    currentPage = pageID;

    /* 6. היסטוריה */
    if (forceState) {
      const url = new URL(location.href);
      url.searchParams.set('page', pageID);
      history.pushState({}, '', url);
    }
  }

  return { loadPage };
})();



/* ───────── ניקוי SessionStorage ביציאה ───────── */
function clearStorageAndLogout(e) {
  console.log("clearStorageAndLogout");
  e.preventDefault();
  [current_site_content, current_dashboard_content, current_sub_sidebar].forEach(S.del);
  location.href = e.target.href;
}
window.clearStorageAndLogout = clearStorageAndLogout;