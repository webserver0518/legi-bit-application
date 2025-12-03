/*  base_user_dashboard.js  */
const USER_DEFAULT = 'search_case';

const rolesData = document.getElementById('user-info')?.dataset.roles || '';
const roles = rolesData.split(',').map(r => r.trim()).filter(Boolean);

const Store = window.Core.storage.create('dashboard');

function initDateTimeTicker() {
  function updateDateTime() {
    const n = new Date();
    window.window.utils.setText(window.window.utils.qs('#current-date-text'), n.toLocaleDateString('he-IL'));
    window.window.utils.setText(window.window.utils.qs('#current-time-text'), n.toLocaleTimeString('he-IL'));
  }
  setInterval(updateDateTime, 1000);
  updateDateTime();
}
initDateTimeTicker()

/* ensure sub menu is visible (even if HTML had "collapsed") */
function ensureSubmenuVisible() {
  window.window.utils.qs('#subMenu')?.classList.remove('collapsed');
}

function showSubMenu(type, force = false) {
  Store.set('current_sub_sidebar', type);

  const cont = window.window.utils.qs('#subMenu');
  if (!cont) return;
  if (!force && cont.dataset.type === type) return;
  cont.dataset.type = type;

  let html = '';
  if (type === 'office') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="birds_view_office">מבט על המשרד</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="office_details">פרטי המשרד</a>
      <hr>`;
  } else if (type === 'user') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="personal_details">פרטים אישיים</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="security_mfa">אימות דו-שלבי</a>
      <hr>`;
  } else if (type === 'cases') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="search_case">חיפוש תיק</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="new_case">תיק חדש</a>
      <hr>
      <div class="sub-group" id="recent-cases">
        <ul class="list-unstyled mb-0" id="recent-cases-list"></ul>
      </div>
      <hr>`;
  } else if (type === 'clients') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="search_client">חיפוש לקוח</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="new_client">לקוח חדש</a>
      <hr>
      `;
  } else if (type === 'files') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="search_file">חיפוש קובץ</a>
      <hr>
      `;
  } else if (type === 'attendance') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="clock_in_out">דיווח</a>
      <hr>`;
  } else if (type === 'calendar') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="calendar_office">יומן משרד</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="calendar_user">יומן משתמש</a>
      <hr>`;
  } else if (type === 'support') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="contact">צור קשר</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="faq">שאלות ותשובות</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="remote_control">שליטה מרחוק</a>
      <hr>`;
  } else if (type === 'regulations') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="statement">הצהרה</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="accessibility_statement">הצהרת נגישות</a>
      <hr>`;
  }

  cont.innerHTML = html;

  // make sure it’s visible after (re)build
  ensureSubmenuVisible();

  if (type === 'cases') {
    renderRecentCases();
    bindRecentCasesEvents();
  }
}

window.addEventListener('DOMContentLoaded', () => {

  // Office name
  fetch('/get_office_name')
    .then(r => r.text())
    .then(name => {
      const officeEl = window.utils.qs('#office-name');
      if (officeEl) officeEl.innerHTML = `<span><img src="/static/images/icons/OFFICE.svg" class="sidebar-icon"> ${name}</span>`;
    })
    .catch(() => { });

  // user full name
  fetch('/get_username')
    .then(r => r.text())
    .then(name => {
      const el = window.utils.qs('#username');
      if (el) el.innerHTML = `<img src="/static/images/icons/USER.svg" class="sidebar-icon"> ${name}`;
    })
    .catch(() => { });

  if (!Store.get('current_sub_sidebar')) Store.set('current_sub_sidebar', 'cases');
  showSubMenu(Store.get('current_sub_sidebar'), true);
  ensureSubmenuVisible(); // <- important

  const targetPage = Store.get('current_dashboard_content') || USER_DEFAULT;
  window.UserLoader.navigate({ page: targetPage, force: true })

  // Highlight in main sidebar
  window.utils.qsa('.sidebar a').forEach(a => {
    (a.dataset.subSidebar === Store.get('current_sub_sidebar')) ? a.classList.add('active') : a.classList.remove('active');
  });
  // Highlight in sub sidebar
  window.utils.qsa('.sub-sidebar a').forEach(a => {
    (a.dataset.page === targetPage) ? a.classList.add('active') : a.classList.remove('active');
  });

  // Sidebar clicks
  const sidebar = window.utils.qs('.sidebar');
  if (sidebar) {
    window.utils.delegate(sidebar, 'click', '.sidebar-link', (e, link) => {
      e.preventDefault();
      window.Nav.highlightInSidebar(link, 'sidebar');
      if (link.dataset.subSidebar) {
        showSubMenu(link.dataset.subSidebar);
        ensureSubmenuVisible(); // <- ensure visible after switching sections

        window.UserLoader.navigate({ page: link.dataset.subSidebar, force: true });
      }
    });
  }

  // Sub-sidebar clicks
  const subSidebar = window.utils.qs('.sub-sidebar');
  if (subSidebar) {
    window.utils.delegate(subSidebar, 'click', '.sub-sidebar-link', (e, link) => {
      e.preventDefault();
      window.Nav.highlightInSidebar(link, 'sub-sidebar');
      // Ensure compatibility with loader.js
      link.dataset.type = 'user';
      window.UserLoader.navigate({ linkEl: link, page: link.dataset.page, force: true });
    });
  }

});

/* Mobile toggle */
function toggleSidebar() {
  document.body.classList.toggle('sidebar-collapsed');
  document.querySelector('.sidebar')?.classList.toggle('collapsed');
  document.querySelector('.sub-sidebar')?.classList.toggle('collapsed');
}



// Disable Ctrl + Scroll and Ctrl + (+ / -)
document.addEventListener('wheel', function (e) {
  if (e.ctrlKey) e.preventDefault();
}, { passive: false });

document.addEventListener('keydown', function (e) {
  if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=')) {
    e.preventDefault();
  }
});



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