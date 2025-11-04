/*  base_admin_dashboard.js  */
const ADMIN_DEFAULT = 'users_management';
const rolesData = document.getElementById('user-info')?.dataset.roles || '';
const roles = rolesData.split(',').map(r => r.trim()).filter(Boolean);

function showToast(message, type = 'info') {
  const container = document.querySelector('.toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast align-items-center text-white bg-${type} border-0`;
  el.setAttribute('role','alert');
  el.innerHTML = `<div class="d-flex"><div class="toast-body text-center w-100">${message}</div></div>`;
  container.appendChild(el);
  new bootstrap.Toast(el, { delay: 2500 }).show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

function highlightInSidebar(link){
  document.querySelectorAll('.sidebar a').forEach(a=>a.classList.remove('active'));
  link.classList.add('active');
}

function updateDateTime(){
  const n = new Date();
  const d = document.getElementById('current-date');
  const t = document.getElementById('current-time');
  if (d) d.textContent = n.toLocaleDateString('he-IL');
  if (t) t.textContent = n.toLocaleTimeString('he-IL');
}
setInterval(updateDateTime, 1000); updateDateTime();

window.addEventListener('DOMContentLoaded', () => {

  // Office name
  fetch('/get_office_name').then(r => r.text()).then(name => {
    const el = document.getElementById('office-name'); if (el) el.textContent = name;
  }).catch(()=>{});

  const targetPage = S.get(current_dashboard_content) || ADMIN_DEFAULT;

  // Initial load
  const firstActive = [...document.querySelectorAll('.sidebar-link')]
    .find(a => a.dataset.page === targetPage) || document.querySelector('.sidebar-link');
  if (firstActive) highlightInSidebar(firstActive);
  loadContent(targetPage, true, 'admin');

  // Clicks
  document.querySelector('.sidebar')?.addEventListener('click', (e) => {
    const link = e.target.closest('.sidebar-link');
    if (!link) return;
    e.preventDefault();
    highlightInSidebar(link);
    // Ensure compatibility with loader.js
    link.dataset.type = 'admin';
    navigateTo(link, true);
  });
});
