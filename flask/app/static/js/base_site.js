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

  // 🔵 Accessibility – toggle open/close + פעולות
  const accToggle = document.getElementById('accessibility-toggle');
  const accPanel = document.getElementById('accessibility-panel');

  if (accToggle && accPanel) {
    const body = document.body;
    const OPEN_CLASS = 'accessibility-open';

    const AccStore = window.Core.storage.create('accessibility');
    const defaultState = {
      fontScale: 0,          // שלבים -2..+3
      grayscale: false,
      highContrast: false,
      invertContrast: false,
      lightBg: false,
      highlightLinks: false,
      readableFont: false
    };
    const FILTER_FLAGS = ['grayscale', 'highContrast', 'invertContrast'];

    let state = Object.assign({}, defaultState, AccStore.get('state', {}));

    const setPanelOpen = (isOpen) => {
      accToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      accPanel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    };

    function applyState() {
      // 🔹 פונט – שינוי גודל על ה-html
      const base = 100;
      const step = 10; // כל לחיצה 10%
      const scale = base + (state.fontScale || 0) * step;
      document.documentElement.style.fontSize = scale + '%';

      // 🔹 מחיקת כל הקלאסים
      body.classList.remove(
        'acc-gray',
        'acc-contrast-high',
        'acc-contrast-invert',
        'acc-bg-light',
        'acc-links-highlight',
        'acc-readable-font'
      );

      if (state.grayscale) body.classList.add('acc-gray');
      if (state.highContrast) body.classList.add('acc-contrast-high');
      if (state.invertContrast) body.classList.add('acc-contrast-invert');
      if (state.lightBg) body.classList.add('acc-bg-light');
      if (state.highlightLinks) body.classList.add('acc-links-highlight');
      if (state.readableFont) body.classList.add('acc-readable-font');

      // 🔹 עדכון ה-highlight של הכפתורים בפאנל
      accPanel.querySelectorAll('.accessibility-panel-item').forEach(li => {
        li.classList.remove('is-active');
      });

      function mark(action, active) {
        const btn = accPanel.querySelector(`button[data-action="${action}"]`);
        if (!btn) return;
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        const li = btn.closest('.accessibility-panel-item');
        if (li && active) li.classList.add('is-active');
      }

      mark('gray', state.grayscale);
      mark('contrast-high', state.highContrast);
      mark('contrast-invert', state.invertContrast);
      mark('bg-light', state.lightBg);
      mark('links', state.highlightLinks);
      mark('font-readable', state.readableFont);
    }

    function saveState() {
      AccStore.set('state', state);
    }

    function changeFont(delta) {
      const MIN = -2;
      const MAX = 3;
      const next = (state.fontScale || 0) + delta;
      state.fontScale = Math.max(MIN, Math.min(MAX, next));
    }

    function toggleFlag(flag, mutuallyExclusiveFilter = false) {
      state[flag] = !state[flag];
      if (mutuallyExclusiveFilter && state[flag]) {
        // רק אחד מגווני אפור / ניגודיות גבוהה / ניגודיות הפוכה יכול להיות פעיל
        FILTER_FLAGS.forEach(name => {
          if (name !== flag) state[name] = false;
        });
      }
    }

    function resetAll() {
      state = Object.assign({}, defaultState);
      document.documentElement.style.fontSize = '';
    }

    function handleAction(action) {
      switch (action) {
        case 'font-up':
          changeFont(+1);
          break;
        case 'font-down':
          changeFont(-1);
          break;
        case 'gray':
          toggleFlag('grayscale', true);
          break;
        case 'contrast-high':
          toggleFlag('highContrast', true);
          break;
        case 'contrast-invert':
          toggleFlag('invertContrast', true);
          break;
        case 'bg-light':
          toggleFlag('lightBg');
          break;
        case 'links':
          toggleFlag('highlightLinks');
          break;
        case 'font-readable':
          toggleFlag('readableFont');
          break;
        case 'reset':
          resetAll();
          break;
      }
      applyState();
      saveState();
    }

    // 🟢 לשחזר מצב קיים (אם יש) כשנטען הדף
    applyState();
    setPanelOpen(body.classList.contains(OPEN_CLASS));

    // פתיחה/סגירה של הפאנל
    accToggle.addEventListener('click', (ev) => {
      ev.preventDefault();
      const isOpen = body.classList.toggle(OPEN_CLASS);
      setPanelOpen(isOpen);
    });

    // האזנה לכל הכפתורים בתוך הפאנל
    const list = accPanel.querySelector('.accessibility-panel-list');
    if (list) {
      list.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button[data-action]');
        if (!btn) return;
        ev.preventDefault();
        const action = btn.dataset.action;
        handleAction(action);
      });
    }
  }


});