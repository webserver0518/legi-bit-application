/*  base_user_dashboard.js  */
const USER_DEFAULT = 'cases_birds_view';

const rolesData = document.getElementById('user-info')?.dataset.roles || '';
const roles = rolesData.split(',').map(r => r.trim()).filter(Boolean);

const toastModulePromise = import('/static/js/core/toast.js');
const utilsModulePromise = import('/static/js/core/utils.js');
const apiModulePromise = import('/static/js/core/api.js');
const tablesModulePromise = import('/static/js/core/tables.js');

let API = null;
apiModulePromise
  .then((mod) => { window.API = mod; API = mod; })
  .catch((err) => console.error('Failed to load API module', err));

let Tables = null;
tablesModulePromise
  .then((mod) => { window.Tables = mod; Tables = mod; })
  .catch((err) => console.error('Failed to load Tables module', err));

const utilsFallback = {
  qs: (selector, scope = document) => scope?.querySelector?.(selector) || null,
  qsa: (selector, scope = document) => scope?.querySelectorAll ? Array.from(scope.querySelectorAll(selector)) : [],
  delegate: (root, eventName, selector, handler, options) => {
    if (!root?.addEventListener) return () => { };
    const listener = (event) => {
      const match = event.target?.closest(selector);
      if (match && root.contains(match)) handler(event, match);
    };
    root.addEventListener(eventName, listener, options);
    return () => root.removeEventListener(eventName, listener, options);
  },
  setText: (el, text = '') => { if (el) el.textContent = text ?? ''; },
  htmlToFragment: (html) => {
    if (!html) return document.createDocumentFragment();
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
  },
};

let utils = utilsFallback;
utilsModulePromise
  .then((mod) => { utils = { ...utilsFallback, ...mod }; })
  .catch((err) => console.error('Failed to load utils module', err));

function showToast(message, type = 'info', opts = {}) {
  toastModulePromise
    .then(({ showToast: coreShowToast }) => {
      coreShowToast(message, type, opts);
    })
    .catch((err) => {
      console.error('Failed to load toast module', err);
    });
}

function highlightInSidebar(link, sidebarClass) {
  if (!link) return;
  utils.qsa(`.${sidebarClass} a`).forEach((a) => a.classList.remove('active'));
  link.classList.add('active');
}

function updateDateTime() {
  const n = new Date();
  utils.setText(utils.qs('#current-date-text'), n.toLocaleDateString('he-IL'));
  utils.setText(utils.qs('#current-time-text'), n.toLocaleTimeString('he-IL'));
}
setInterval(updateDateTime, 1000); updateDateTime();

/* ensure sub menu is visible (even if HTML had "collapsed") */
function ensureSubmenuVisible() {
  utils.qs('#subMenu')?.classList.remove('collapsed');
}

function showSubMenu(type, force = false) {
  S.set(current_sub_sidebar, type);

  const cont = utils.qs('#subMenu');
  if (!cont) return;
  if (!force && cont.dataset.type === type) return;
  cont.dataset.type = type;

  let html = '';
  if (type === 'all_cases') {
    html = `
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="cases_birds_view">מבט על תיקים</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="cases">תיקים</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="add_case">הוספת תיק</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="view_case">צפייה בתיק</a>`;
  } else if (type === 'all_clients') {
    html = `
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="clients_birds_view">מבט על לקוחות</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="clients">לקוחות</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="add_client">הוספת לקוח</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="view_client">צפייה בלקוח</a>`;
  } else if (type === 'attendance') {
    html = `
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="attendance_birds_view">מבט על נוכחות</a>`;
  }

  const fragment = utils.htmlToFragment(html);
  if (fragment) {
    cont.replaceChildren(fragment);
  } else {
    cont.innerHTML = html;
  }

  // make sure it’s visible after (re)build
  ensureSubmenuVisible();

  // highlight retained page if exists
  const pageNow = S.get(current_dashboard_content);
  if (pageNow) {
    const link = cont.querySelector(`[data-page="${pageNow}"]`);
    if (link) highlightInSidebar(link, 'sub-sidebar');
  }
}

window.addEventListener('DOMContentLoaded', () => {

  // Office name
  fetch('/get_office_name')
    .then(r => r.text())
    .then(name => {
      const officeEl = utils.qs('#office-name');
      if (officeEl) officeEl.innerHTML = `<span><img src="/static/images/icons/OFFICE.svg" class="sidebar-icon"> ${name}</span>`;
    })
    .catch(() => { });

  // user full name
  fetch('/get_username')
    .then(r => r.text())
    .then(name => {
      const el = utils.qs('#username');
      if (el) el.innerHTML = `<img src="/static/images/icons/USER.svg" class="sidebar-icon"> ${name}`;
    })
    .catch(() => { });

  if (!S.get(current_sub_sidebar)) S.set(current_sub_sidebar, 'all_cases');
  showSubMenu(S.get(current_sub_sidebar), true);
  ensureSubmenuVisible(); // <- important

  const targetPage = S.get(current_dashboard_content) || USER_DEFAULT;
  loadContent(targetPage, true, 'user');

  // Highlight in main sidebar
  utils.qsa('.sidebar a').forEach(a => {
    (a.dataset.subSidebar === S.get(current_sub_sidebar)) ? a.classList.add('active') : a.classList.remove('active');
  });
  // Highlight in sub sidebar
  utils.qsa('.sub-sidebar a').forEach(a => {
    (a.dataset.page === targetPage) ? a.classList.add('active') : a.classList.remove('active');
  });

  // Sidebar clicks
  const sidebar = utils.qs('.sidebar');
  if (sidebar) {
    utils.delegate(sidebar, 'click', '.sidebar-link', (e, link) => {
      e.preventDefault();
      highlightInSidebar(link, 'sidebar');
      if (link.dataset.subSidebar) {
        showSubMenu(link.dataset.subSidebar);
        ensureSubmenuVisible(); // <- ensure visible after switching sections
      }
    });
  }

  // Sub-sidebar clicks
  const subSidebar = utils.qs('.sub-sidebar');
  if (subSidebar) {
    utils.delegate(subSidebar, 'click', '.sub-sidebar-link', (e, link) => {
      e.preventDefault();
      highlightInSidebar(link, 'sub-sidebar');
      // Ensure compatibility with loader.js
      link.dataset.type = 'user';
      navigateTo(link, true);
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