/*  base_user_dashboard.js  */
const USER_DEFAULT = 'cases_birds_view';

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
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="office_birds_view">מבט על המשרד</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="office_statuses">סטטוסים</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="office_add_user">הוספת משתמש</a>
      `;
  } else if (type === 'user') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="user_birds_view">מבט על משתמש</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="user_update">עדכון</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="security_mfa">אבטחת MFA</a>
      `;
  } else if (type === 'all_cases') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="cases_birds_view">מבט על תיקים</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="cases">תיקים</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="new_case">הוספת תיק</a>
      <hr>
      <div class="sub-group" id="recent-cases">
        <ul class="list-unstyled mb-0" id="recent-cases-list"></ul>
      </div>
      `;
  } else if (type === 'all_clients') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="clients">לקוחות</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="new_client">הוספת לקוח</a>
      <hr>
      `;
  } else if (type === 'all_files') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="files">קבצים</a>
      <hr>
      `;
  } else if (type === 'attendance') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="attendance_birds_view">מבט על נוכחות</a>`;
  }

  cont.innerHTML = html;

  // make sure it’s visible after (re)build
  ensureSubmenuVisible();

  if (type === 'all_cases') {
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

  if (!Store.get('current_sub_sidebar')) Store.set('current_sub_sidebar', 'all_cases');
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

        let defaultPage = null;
        if (link.dataset.subSidebar === 'all_cases') defaultPage = 'cases';
        else if (link.dataset.subSidebar === 'all_clients') defaultPage = 'clients';
        else if (link.dataset.subSidebar === 'all_files') defaultPage = 'files';
        else if (link.dataset.subSidebar === 'attendance') defaultPage = 'attendance_birds_view';

        if (defaultPage) {
          window.UserLoader.navigate({ page: defaultPage, force: true });
        }
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