/* static/js/admin_components/users_management.js
   Users Management (Add/Edit/Delete) + dynamic roles dropdowns (from /get_roles_list)
   Assumes this module is initialized via: window.init_users_management()
*/

(function () {
  // === Public initializer ===
  window.init_users_management = function () {
    wireAddForm();           // Connect the "add user" form
    wireDeleteButtons();     // Connect delete buttons
    buildRolesMenus().then(() => {
      // Add roles dropdown
      wireRolesMenu('userRoleDropdown', '#addUserForm ul.dropdown-menu', { defaultRole: 'office_owner' });
      // Edit roles dropdown
      wireRolesMenu('editUserRoleDropdown', '#editUserForm ul.dropdown-menu');
    });
  };

  // === Fetch roles list from server and build dropdown menus ===
  async function buildRolesMenus() {
    try {
      const res = await fetch('/get_roles_list', { cache: 'no-store' }); // Request list of roles
      if (!res.ok) throw new Error('Failed to fetch roles list');
      const roles = await res.json(); // Parse roles

      // Find dropdown menus for add/edit user
      const addMenu  = document.querySelector('#addUserForm  ul.dropdown-menu');
      const editMenu = document.querySelector('#editUserForm ul.dropdown-menu');

      // Build each menu with the roles
      buildMenu(addMenu, roles);
      buildMenu(editMenu, roles);
    } catch (e) {
      console.error('loadRolesDropdown error:', e);
      alert('Cannot load roles list. Please refresh.');
    }
  }

    // === Build dropdown items (checkbox list) ===
  function buildMenu(menuEl, roles) {
    if (!menuEl) return;
    menuEl.innerHTML = '';
    roles.forEach(role => {
      const li = document.createElement('li'); // Create list item
      li.innerHTML = `
        <label class="dropdown-item">
          <input type="checkbox" name="roles[]" value="${role.value}">
          ${role.label}
        </label>
      `;
      menuEl.appendChild(li); // Add to menu
    });
  }

  // === Handle dropdown behavior and text updates ===
  function wireRolesMenu(triggerId, menuSelector, opts = {}) {
    const trigger  = document.getElementById(triggerId); // Button that opens dropdown
    const menuEl   = document.querySelector(menuSelector); // Menu container
    if (!trigger || !menuEl) return;

    const checkboxes = [...menuEl.querySelectorAll('input[name="roles[]"]')]; // All role checkboxes

    // Ensure "admin" role is exclusive
    function enforceAdminExclusivity(changedCb) {
      if (changedCb.value === 'admin' && changedCb.checked) {
        checkboxes.forEach(other => { if (other !== changedCb) other.checked = false; });
      } else if (changedCb.value !== 'admin' && changedCb.checked) {
        checkboxes.forEach(other => { if (other.value === 'admin') other.checked = false; });
      }
    }

    // Update dropdown button text with selected roles
    function updateTriggerText() {
      const labels = checkboxes
        .filter(cb => cb.checked)
        .map(cb => cb.parentElement.textContent.trim());
      trigger.innerText = labels.length ? labels.join(', ') : 'בחר תפקידים';
    }

    // Select default role when adding new user
    if (opts.defaultRole) {
      const def = checkboxes.find(cb => cb.value === opts.defaultRole);
      if (def) def.checked = true;
    }
    updateTriggerText();

    // Listen for checkbox changes
    checkboxes.forEach(cb =>
      cb.addEventListener('change', () => {
        enforceAdminExclusivity(cb);
        updateTriggerText();
      })
    );

    // Allow setting roles programmatically (used in edit modal)
    menuEl._setRoles = function setRoles(values = []) {
      checkboxes.forEach(cb => (cb.checked = false)); // Reset all
      // Mark selected
      values.forEach(v => {
        const cb = checkboxes.find(x => x.value === v);
        if (cb) cb.checked = true;
      });
      // Apply admin rule again
      const adminCb = checkboxes.find(x => x.value === 'admin');
      if (adminCb && adminCb.checked) {
        checkboxes.forEach(other => { if (other !== adminCb) other.checked = false; });
      } else {
        if (checkboxes.some(x => x.checked && x.value !== 'admin') && adminCb) {
          adminCb.checked = false;
        }
      }
      updateTriggerText();
    };
  }

  // === Add new user ===
  function wireAddForm() {
    const form = document.getElementById('addUserForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault(); // Prevent page reload

      const fd = new FormData(form);
      fd.append('action', 'add');
      fd.append('created_at', localIsoWithOffset(new Date())); // Add timestamp

      try {
        const res = await fetch('/manage_user', { method: 'POST', body: fd }); // Send to server
        if (res.ok) {
          showToast('✅ User added', 'success');
          loadContent('users_management', true, 'admin'); // Refresh page
        } else if (res.status === 409) {
          alert('⚠️ User already exists');
        } else {
          const text = await res.text();
          alert(text || '❌ Error adding user');
        }
      } catch (err) {
        console.error(err);
        alert('❌ Network error while adding user');
      }
    });
  }

  // === Delete user ===
  function wireDeleteButtons() {
    window.deleteUser = function (button) {
      const row = button.closest('tr');
      const username = row?.dataset.username;
      const officeSerial = row?.dataset.officeSerial;

      if (!row || !username || !officeSerial) {
        alert('❌ Missing user context');
        return;
      }

      if (!confirm(`Delete user “${username}”?`)) return;

      const fd = new FormData();
      fd.append('action', 'delete');
      fd.append('username', username);
      fd.append('office_serial', officeSerial);

      fetch('/manage_user', { method: 'POST', body: fd })
        .then(r => {
          if (r.ok) {
            showToast('✅ User deleted', 'success');
            loadContent('users_management', true, 'admin');
          } else {
            alert('❌ Delete failed');
          }
        })
        .catch(err => {
          console.error(err);
          alert('❌ Network error while deleting user');
        });
    };
  }

// === Open edit user modal ===
  window.openEditUserModal = function (button) {
      const row = button.closest('tr');
      if (!row) return;
      const username = row.dataset.username;
      const officeSerial = row.dataset.officeSerial;
      const officeName = row.dataset.officeName;
      const email = row.children[4]?.textContent.trim() || '';
      const rolesText = row.children[3]?.textContent.trim() || '';

    // Fill modal fields
    document.getElementById('editUsername').value     = username;
    document.getElementById('editOfficeName').value   = officeName;
    document.getElementById('editEmail').value        = email;
    document.getElementById('editPassword').value     = '';
    document.getElementById('editOfficeSerial').value = officeSerial;

    // Update modal title
    const modalTitle = document.getElementById('editUserModalLabel');
    modalTitle.textContent = `Edit user ${username}${officeName ? ` in office ${officeName}` : ''}`;


    // Mark roles from the table
    const editMenu = document.querySelector('#editUserForm ul.dropdown-menu');
    const rolesArr = rolesText ? rolesText.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (editMenu && typeof editMenu._setRoles === 'function') {
      editMenu._setRoles(rolesArr);
    }

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
    modal.show();
  };

  // === Save changes when clicking "Save" in modal ===
  document.getElementById('saveEditUserBtn')?.addEventListener('click', async () => {
    const form = document.getElementById('editUserForm');
    const fd = new FormData(form);
    fd.append('action', 'edit');

    try {
      const res = await fetch('/manage_user', { method: 'POST', body: fd });
      const text = await res.text();
      if (res.ok) {
        showToast('✅ User updated successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
        loadContent('users_management', true, 'admin');
      } else {
        alert(text || '❌ Error updating user');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Network error while updating user');
    }
  });

  // === Convert local time to ISO string with timezone offset ===
  function localIsoWithOffset(d) {
    const tz = -d.getTimezoneOffset();
    const sign = tz >= 0 ? '+' : '-';
    const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0');
    return (
      d.getFullYear() + '-' +
      pad(d.getMonth() + 1) + '-' +
      pad(d.getDate()) + 'T' +
      pad(d.getHours()) + ':' +
      pad(d.getMinutes()) +
      sign + pad(tz / 60) + ':' + pad(tz % 60)
    );
  }
})();




async function loadUsersAsync() {
  const tableBody = document.querySelector('#usersTable tbody');
  tableBody.innerHTML = '<tr><td colspan="100%">⌛ loading data</td></tr>';

  try {
    const res = await fetch('/get_all_users');
    const payload = await res.json();
    if (payload.success) {
      renderUsersTable(payload.data);
    } else {
      tableBody.innerHTML = `<tr><td colspan="100%">${payload.error}</td></tr>`;
    }
  } catch (e) {
    tableBody.innerHTML = `<tr><td colspan="100%">loading error</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tableBody = document.querySelector('#usersTable tbody');
  tableBody.innerHTML = users.map(u => `
    <tr data-office-name="${u.office_name || ''}"
        data-office-serial="${u.office_serial || ''}"
        data-username="${u.username}">

      <td>${u.office_serial || '-'}</td>
      <td>${u.office_name || '-'}</td>
      <td>${u.username}</td>
      <td>${u.roles?.join(', ') || '-'}</td>
      <td>${u.email || '-'}</td>
      <td>${u.created_at || '-'}</td>
      <td>
        <button class="btn btn-secondary btn-sm small-btn" onclick="openEditUserModal(this)">
            edit
        </button>
      </td>
    </tr>
  `).join('');
}

document.addEventListener('DOMContentLoaded', loadUsersAsync);