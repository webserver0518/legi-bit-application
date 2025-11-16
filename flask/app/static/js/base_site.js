/*************************************************
*          base_site.js  –  משתמש ב-Loader       *
**************************************************/
const DEFAULT_PAGE = 'home';  // ← שם יחיד ב-storage

/* אתחול */
window.addEventListener('DOMContentLoaded', () => {

  /* padding-top לפי גובה navbar */
  const dynamicContainer = window.utils.qs('#dynamicContent');
  const nav = window.utils.qs('.navbar');
  if (nav && dynamicContainer) dynamicContainer.style.paddingTop = nav.offsetHeight + 'px';

  /* טעינה ראשונית */
  const Store = window.Core.storage.create('loader.site');
  const pageSaved = Store.get('current_site_content') || DEFAULT_PAGE;

  window.SiteLoader.load({
    page: pageSaved,
    force: true
  });

  /* ניווט דינמי – מאזין לכל הלחיצות */
  if (nav) {
    window.utils.delegate(nav, 'click', '.nav-link', (e, link) => {
      const page = link.dataset.page;
      if (!page) return;
      e.preventDefault();
      window.SiteLoader.navigate({ linkEl: link, page, force: true });
      return;
    });
  }

});