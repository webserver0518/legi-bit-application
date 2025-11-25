/*  base_user_dashboard.js  */
const USER_DEFAULT = 'birds_view_cases';

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
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="birds_view_user">מבט על משתמש</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="personal_details">פרטים אישיים</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="security_mfa">אימות דו-שלבי</a>
      <hr>`;
  } else if (type === 'cases') {
    html = `
      <hr>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="birds_view_cases">מבט על תיקים</a>
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
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="birds_view_clients">מבט על לקוחות</a>
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
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="birds_view_attendance">מבט על נוכחות</a>
      <a href="#" class="sub-sidebar-link" data-type="user" data-sidebar="sub-sidebar" data-page="clock_in_out">דיווח</a>
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

        let defaultPage = null;
        if (link.dataset.subSidebar === 'office') defaultPage = 'birds_view_office';
        else if (link.dataset.subSidebar === 'user') defaultPage = 'birds_view_user';
        else if (link.dataset.subSidebar === 'cases') defaultPage = 'cases';
        else if (link.dataset.subSidebar === 'clients') defaultPage = 'clients';
        else if (link.dataset.subSidebar === 'files') defaultPage = 'files';
        else if (link.dataset.subSidebar === 'attendance') defaultPage = 'clock_in_out';

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