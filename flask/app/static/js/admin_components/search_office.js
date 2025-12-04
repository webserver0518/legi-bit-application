/* office_user_manager.js — dynamic AdminLoader page */
(function () {
  'use strict';

  const sel = (s, r = document) => r.querySelector(s);
  const selAll = (s, r = document) => Array.from(r.querySelectorAll(s));

  // state
  let allOffices = [];
  let selectedOffice = null;

  // elements (scoped under the page root)
  function els() {
    const root = sel('#office-user-manager');
    return root ? {
      root,
      search: sel('#oum-search', root),
      clear: sel('#oum-clear', root),
      empty: sel('#oum-empty', root),
      offices: sel('#oum-offices', root),
      usersWrap: sel('#oum-users-wrap', root),
      usersHint: sel('#oum-users-hint', root),
      usersTbody: sel('#oum-users-tbody', root),
      badge: sel('#oum-office-badge', root),
      addForm: sel('#oum-add-form', root),
      addNote: sel('#oum-add-note', root),
    } : {};
  }

  function toastOK(msg) { window.Toast?.success?.(msg) || window.Toast?.info?.(msg); }
  function toastWarn(msg) { window.Toast?.warning?.(msg) || window.Toast?.info?.(msg); }
  function toastErr(msg) { window.Toast?.danger?.(msg) || window.Toast?.info?.(msg); }

  // ---- API helpers using global window.API (ResponseManager normalized) ----
  async function apiGet(url) { return window.API.getJson(url); }
  async function apiPost(url, body) { return window.API.postJson(url, body); }
  async function apiDel(url) { return window.API.delete(url); }

  // ---- Offices ----
  async function loadOffices() {
    const res = await apiGet('/search_offices');
    if (!res.success) {
      toastErr('טעינת רשימת המשרדים נכשלה');
      return [];
    }
    const items = Array.isArray(res.data) ? res.data : [];
    allOffices = items;
    return items;
  }

  function renderOffices() {
    const { search, empty, offices } = els();
    const q = (search.value || '').trim().toLowerCase();
    const list = allOffices
      .filter(o => (o.name || '').toLowerCase().includes(q))
      .slice(0, 40);

    offices.innerHTML = '';
    if (!list.length) { empty.hidden = false; return; }
    empty.hidden = true;

    list.forEach(o => {
      const li = document.createElement('li');

      const left = document.createElement('div');
      left.className = 'om-left';
      const t = document.createElement('div'); t.className = 'om-title';
      t.textContent = o.name || `משרד #${o.serial}`;
      const s = document.createElement('div'); s.className = 'om-sub';
      s.textContent = `מס׳ משרד: ${o.serial}`;
      left.appendChild(t); left.appendChild(s);

      const actions = document.createElement('div');
      actions.className = 'om-actions';
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline-primary';
      btn.textContent = 'בחר/י';
      btn.addEventListener('click', () => selectOffice(o));
      actions.appendChild(btn);

      li.appendChild(left);
      li.appendChild(actions);
      offices.appendChild(li);
    });
  }

  // ---- Users ----
  async function selectOffice(office) {
    const { usersWrap, usersHint, usersTbody, badge } = els();
    selectedOffice = office;

    badge.hidden = false;
    badge.textContent = `נבחר: ${office.name} (#${office.serial})`;

    usersHint.hidden = true;
    usersWrap.hidden = false;
    usersTbody.innerHTML = `<tr><td colspan="6">טוען...</td></tr>`;

    const users = await fetchUsers(office.serial);
    renderUsers(users || []);
  }

  async function fetchUsers(officeSerial) {
    // ניסיון 1: query param
    let res = await apiGet(`/get_office_users?office_serial=${encodeURIComponent(officeSerial)}`);
    console.log('fetchUsers response:', res);
    if (res.success && Array.isArray(res.data)) return res.data;

    // ניסיון 2: POST עם גוף JSON (אם ה־route אצלך קורא get_json גם ב־GET)
    res = await apiPost('/get_office_users', { office_serial: Number(officeSerial) });
    if (res.success && Array.isArray(res.data)) return res.data;

    toastWarn('לא ניתן למשוך משתמשים למשרד (דרוש עדכון API)');
    return [];
  }

  function renderUsers(rows) {
    const { usersTbody } = els();
    usersTbody.innerHTML = '';

    if (!rows.length) {
      usersTbody.innerHTML = '<tr><td colspan="6">אין משתמשים להצגה.</td></tr>';
      return;
    }

    rows.forEach(u => {
      const tr = document.createElement('tr');
      const roles = Array.isArray(u.roles) ? u.roles.join(', ') : (u.roles || '');
      tr.innerHTML = `
        <td>${safe(u.serial)}</td>
        <td>${safe(u.username)}</td>
        <td>${safe(u.full_name || u.name)}</td>
        <td>${safe(u.email)}</td>
        <td>${safe(roles)}</td>
        <td>
          <button class="btn btn-sm btn-danger oum-del" data-serial="${u.serial}">מחק</button>
        </td>`;
      usersTbody.appendChild(tr);
    });

    selAll('.oum-del', usersTbody).forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.serial);
        if (!Number.isFinite(id)) return;
        if (!confirm(`למחוק את משתמש ${id}?`)) return;
        await deleteUser(id);
        const users = await fetchUsers(selectedOffice.serial);
        renderUsers(users || []);
      });
    });
  }

  function safe(v) { return (v ?? '-') + ''; }

  async function deleteUser(userSerial) {
    if (!selectedOffice) return toastWarn('בחר/י משרד קודם');
    const url = `/admin/users?office_serial=${encodeURIComponent(selectedOffice.serial)}&user_serial=${encodeURIComponent(userSerial)}`;
    const res = await apiDel(url);
    if (!res.success) toastErr('מחיקה נכשלה (יש להשלים Route בצד שרת)');
    else toastOK('המשתמש נמחק');
  }

  // ---- Add user ----
  function bindAddForm() {
    const { addForm, addNote } = els();
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedOffice) return toastWarn('בחר/י משרד קודם');

      const fd = new FormData(addForm);
      const payload = {
        office_serial: Number(selectedOffice.serial),
        username: (fd.get('username') || '').trim(),
        full_name: (fd.get('full_name') || '').trim(),
        email: (fd.get('email') || '').trim(),
        password: (fd.get('password') || '').trim(),
        roles: String(fd.get('roles') || '').split(',').map(s => s.trim()).filter(Boolean)
      };

      if (!payload.username || !payload.password) {
        return toastWarn('נא למלא שם משתמש, שם מלא וסיסמה');
      }

      const res = await apiPost('/admin/users', payload);
      if (!res.success) {
        addNote.textContent = 'הוספה נכשלה (דרוש Route בצד שרת).';
        toastErr('הוספה נכשלה (Route חסר)');
        return;
      }
      addNote.textContent = 'נוסף בהצלחה.';
      addForm.reset();
      const users = await fetchUsers(selectedOffice.serial);
      renderUsers(users || []);
    });
  }

  // ---- bindings ----
  function bindSearch() {
    const { search, clear } = els();
    search.addEventListener('input', renderOffices);
    clear.addEventListener('click', () => {
      search.value = '';
      renderOffices();
      search.focus();
    });
  }

  // ---- init entrypoint for AdminLoader ----
  window.init_search_office = async function () {
    const nodes = els();
    if (!nodes.root) return;

    bindSearch();
    bindAddForm();

    await loadOffices();
    renderOffices();
  };
})();
