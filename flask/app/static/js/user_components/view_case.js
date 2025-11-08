// static/js/view_case.js

(() => {
  // helpers
  const $ = (id) => document.getElementById(id);
  const setVal = (id, v) => { const el = $(id); if (el) el.value = v ?? ""; };
  const toast = (msg, level = "danger") =>
  (window.Core?.toast?.showToast?.(document.querySelector('.toast-container'), msg, level)
    || console[level === 'danger' ? 'error' : 'log'](msg));

  const serial = sessionStorage.getItem('selectedCaseSerial');
  if (!serial) { toast("Please select a case first", "warning"); return; }

  // render data
  function renderData(d) {
    const c = d.cases;
    const client = c.client;
    setVal('case-serial', c.serial);
    setVal('case-created-at', c.created_at);
    setVal('case-status', c.status);
    setVal('case-title', c.title);
    setVal('case-field', c.field);
    setVal('case-facts', c.facts);
    setVal('client-serial', client.serial);
    setVal('client-created-at', client.created_at);
    setVal('client-first-name', client.first_name);
    setVal('client-last-name', client.last_name);
    setVal('client-id-card-number', client.id_card_number);
    setVal('client-email', client.email);
    setVal('client-phone', client.phone);
    setVal('client-city', client.city);
    setVal('client-street', client.street);
    setVal('client-street-number', client.street_number);
    setVal('client-postal-code', client.postal_code);
    const tbody = document.querySelector('#case-files tbody');
    if (!tbody) return;
    const files = Array.isArray(c.files) ? c.files : [];
    tbody.innerHTML = files.length
      ? files.map(fn => `<tr><td>${fn}</td><td><span class="text-muted small">Download coming soon</span></td></tr>`).join('')
      : `<tr><td colspan="100%" class="text-muted">אין קבצים</td></tr>`;
  }

  // fetch case data
  fetch(`/get_case?serial=${encodeURIComponent(serial)}&expand=true`)
    .then(r => r.json())
    .then(payload => {
      if (payload?.success && payload?.data) renderData(payload.data);
      else toast(payload.error || "Error rendering case");
    })
    .catch(err => { console.error("❌ get_case(serial) error:", err); toast("Error loading case data", "danger"); });

  // delete case
  window.deleteCase = function () {
    const serial = $('case-serial')?.value;
    if (!serial) return toast("Please select a case first", "danger");
    if (confirm(`This action is irreversible! Delete case [${serial}]?`)) {
      fetch(`/delete_case?serial=${encodeURIComponent(serial)}`, { method: "DELETE" })
        .then(r => r.json())
        .then(payload => {
          if (payload?.success) {
            toast("Case deleted successfully", "success");
            setTimeout(() => (window.location.href = "/dashboard"), 1200);
          } else toast(payload?.error || "Error while deleting", "danger");
        })
        .catch(err => { console.error("❌ deleteCase error:", err); toast("Internal server error", "danger"); });
    }
  };

  // update case status
  window.updateCaseStatus = function (newStatus) {
    const serial = $('case-serial')?.value;
    if (!serial) return toast("Please select a case first", "danger");
    if (!newStatus) return toast("Missing target status", "warning");
    fetch(`/update_case_status?serial=${encodeURIComponent(serial)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    })
      .then(r => r.json())
      .then(payload => {
        if (payload?.success) { toast(`Status changed to '${newStatus}'`, "success"); setVal("case-status", newStatus); }
        else toast(payload?.error || "Error updating status", "danger");
      })
      .catch(err => { console.error("❌ updateCaseStatus error:", err); toast("Internal server error", "danger"); });
  };

  // inline edit
  const originalValues = {};

  // enter edit mode
  window.enterEditMode = function (type) {
    const section = document.querySelector(`section:has([onclick="enterEditMode('${type}')"])`);
    if (!section) return;
    originalValues[type] = {};
    section.classList.add('editing');
    section.querySelectorAll('input').forEach(el => {
      // skip serial fields
      if (el.id.includes('serial')) return;
      originalValues[type][el.id] = el.value;
      el.removeAttribute('readonly');
      el.classList.remove('readonly');
    });
    const btns = section.querySelector('.edit-controls');
    btns.querySelector('.btn-outline-primary').classList.add('d-none');
    btns.querySelector('.btn-success').classList.remove('d-none');
    btns.querySelector('.btn-secondary').classList.remove('d-none');
  };

  // cancel edit
  window.cancelEdit = function (type) {
    const section = document.querySelector(`section:has([onclick="enterEditMode('${type}')"])`);
    if (!section) return;
    section.classList.remove('editing');
    section.querySelectorAll('input').forEach(el => {
      if (el.id.includes('serial')) return;
      el.value = originalValues[type]?.[el.id] ?? el.value;
      el.setAttribute('readonly', true);
      el.classList.add('readonly');
    });
    const btns = section.querySelector('.edit-controls');
    btns.querySelector('.btn-outline-primary').classList.remove('d-none');
    btns.querySelector('.btn-success').classList.add('d-none');
    btns.querySelector('.btn-secondary').classList.add('d-none');
  };

  // save section
  window.saveSection = async function (type) {
    const section = document.querySelector(`section:has([onclick="enterEditMode('${type}')"])`);
    if (!section) return;

    const inputs = section.querySelectorAll('input:not([readonly])');
    const payload = {};
    inputs.forEach(el => payload[el.id] = el.value);

    // add serial to query string
    const serialField = type === 'case' ? 'case-serial' : 'client-serial';
    const serialValue = $(serialField)?.value;
    if (!serialValue) {
      toast(`Missing ${type} serial`, 'danger');
      return;
    }

    const endpoint = `${type === 'case' ? '/update_case' : '/update_client'}?serial=${encodeURIComponent(serialValue)}`;

    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data?.success) {
        toast(`${type === 'case' ? 'Case' : 'Client'} updated successfully ✅`, 'success');
        cancelEdit(type);
      } else {
        toast(data?.error || 'Error while saving', 'danger');
      }
    } catch (err) {
      console.error('❌ saveSection error:', err);
      toast('Internal server error', 'danger');
    }
  };
})();
