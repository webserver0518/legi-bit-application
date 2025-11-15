/*************************************************
*          base_site.js  –  משתמש ב-Loader       *
**************************************************/
const DEFAULT_PAGE = 'home';  // ← שם יחיד ב-storage

const utilsModulePromise = import('/static/js/core/utils.js');
const navModulePromise = import('/static/js/core/nav.js');
const siteLoaderModulePromise = import('/static/js/core/loader.site.js');

let utils = null;
utilsModulePromise
  .then((mod) => { window.utils = mod; utils = mod; })
  .catch(() => { throw new Error('utils module failed to load'); });


/* אתחול */
window.addEventListener('DOMContentLoaded', () => {

  /* padding-top לפי גובה navbar */
  const dynamicContainer = utils.qs('#dynamicContent');
  const nav = utils.qs('.navbar');
  if (nav && dynamicContainer) dynamicContainer.style.paddingTop = nav.offsetHeight + 'px';

  /* טעינה ראשונית */
  const pageSaved = S.get(current_site_content) || DEFAULT_PAGE;
  loadContent(
    page = pageSaved,
    force = true,
    type = "site"
  );

  /* ניווט דינמי – מאזין לכל הלחיצות */
  if (nav) {
    utils.delegate(nav, 'click', '.nav-link', (e, link) => {
      const page = link.dataset.page;
      if (!page) return;
      e.preventDefault();
      window.SiteLoader.navigate({ linkEl: link, page, force: true });
      return;
    });
  }

});