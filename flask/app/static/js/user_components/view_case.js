/* static/js/view_case.js */

(() => {
  // --- helpers (global for all functions below) ---
  const $ = (id) => document.getElementById(id);
  const setVal = (id, v) => {
    const el = $(id);
    if (!el) return;
    el.value = v ?? "";
  };
  const toast = (msg, level = "danger") =>
  (window.Core?.toast?.showToast?.(document.querySelector('.toast-container'), msg, level) ||
    console[level === 'danger' ? 'error' : 'log'](msg));

  const serial = sessionStorage.getItem('selectedCaseSerial');
  if (!serial) {
    toast("Please Select a case first", "warning");
    return;
  }

  // --- case rendering ---
  function renderData(d) {

    c = d.cases

    //render case
    setVal('case-serial', c.serial);
    setVal('case-created-at', c.created_at);
    setVal('case-status', c.status);
    setVal('case-title', c.title);
    setVal('case-category', c.category);
    setVal('case-facts', c.facts);


    // render client
    client = c.client
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
    if (!files.length) {
      tbody.innerHTML = `<tr><td colspan="100%" class="text-muted">אין קבצים</td></tr>`;
      return;
    }

    tbody.innerHTML = files.map((fn) => `
          <tr>
            <td>${fn}</td>
            <td><span class="text-muted small">הורדה תתווסף בהמשך</span></td>
          </tr>
        `).join('');
  }

  // --- fetch case data ---
  fetch(`/get_case?serial=${encodeURIComponent(serial)}&expand=true`)
    .then(r => r.json())
    .then(payload => {
      //console.log(payload)
      if (payload?.success && payload?.data) {
        renderData(payload.data);
      } else {
        toast(payload.error || "Error rendering case");
      }
    })
    .catch(err => {
      console.error("❌ get_case(serial) error:", err);
      toast("Error loading case data", "danger");
    });

  // --- delete case ---
  window.deleteCase = function () {
    const serial = $('case-serial')?.value;
    if (!serial) {
      toast("Please Select a case first", "danger");
      return;
    }

    if (confirm(`This is irreversible! Are you sure you want to erase case number [${serial}] ?`)) {
      fetch(`/delete_case?serial=${encodeURIComponent(serial)}`, { method: "DELETE" })
        .then(r => r.json())
        .then(payload => {
          if (payload?.success) {
            toast("Case deleted", "success");
            setTimeout(() => (window.location.href = "/dashboard"), 1200);
          } else {
            toast(payload?.error || "Error while deleting", "danger");
          }
        })
        .catch(err => {
          console.error("❌ deleteCase error:", err);
          toast("Internal server errorrrrr", "danger");
        });
    }
  };

  // --- update case status ---
  window.updateCaseStatus = function (newStatus) {
    const serial = $('case-serial')?.value;
    if (!serial) {
      toast("Please Select a case first", "danger");
      return;
    }

    if (!newStatus) {
      toast("Missing target status", "warning");
      return;
    }

    fetch(`/update_case_status?serial=${encodeURIComponent(serial)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    })
      .then(r => r.json())
      .then(payload => {
        if (payload?.success) {
          toast(`Status changed to '${newStatus}'`, "success");
          setVal("case-status", newStatus);
        } else {
          toast(payload?.error || "Error updating status", "danger");
        }
      })
      .catch(err => {
        console.error("❌ updateCaseStatus error:", err);
        toast("Internal server error", "danger");
      });
  };

})();
