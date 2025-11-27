/*  base_user_dashboard.js  */
const USER_DEFAULT = 'search_office';

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
  if (type === 'offices') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="birds_view_offices">מבט על משרדים</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="search_office">חיפוש משרד</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="new_office">משרד חדש</a>
      <hr>
      <div class="sub-group" id="recent-offices">
        <ul class="list-unstyled mb-0" id="recent-offices-list"></ul>
      </div>
      <hr>`;
  } else if (type === 'users') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="birds_view_users">מבט על משתמשים</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="search_user">חיפוש משתמש</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="new_user">משתמש חדש</a>
      <hr>
      <div class="sub-group" id="recent-users">
        <ul class="list-unstyled mb-0" id="recent-users-list"></ul>
      </div>
      <hr>`;
  } else {
    html = `
      <hr>
      <hr>
      `;
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
  window.AdminLoader.navigate({ page: targetPage, force: true })

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

        window.AdminLoader.navigate({ page: link.dataset.subSidebar, force: true });
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
      window.AdminLoader.navigate({ linkEl: link, page: link.dataset.page, force: true });
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