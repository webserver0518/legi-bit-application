
window.init_view_case = function init_view_case() {

  const navStore = window.Core.storage.create("navigation");
  const lastViewedCase = navStore.get("lastViewedCase");

  document.getElementById("clear-file-filters")?.addEventListener("click", () => {
    document.getElementById("file-search").value = "";
    document.getElementById("file-type").value = "";
    loadFiles();
  });

  const safeValue = (v) => (v && v.trim && v.trim() !== "" ? v : "-");
  const serial = lastViewedCase.serial
  if (!serial) return;

  const filterBar = document.querySelector(".filter-bar");
  window.Tables.setFilterBarLoading(filterBar, true);

  window.API.getJson(`/get_case?serial=${encodeURIComponent(serial)}&expand=true`)
    .then(payload => {

      if (!payload?.success || !payload?.data?.length) return;

      const item = payload.data[0] ?? {};
      const caseObj = item.cases ?? item;

      const user = caseObj.user ?? item.user ?? caseObj.created_by ?? {};
      const clients = Array.isArray(caseObj.clients ?? item.clients) ? (caseObj.clients ?? item.clients) : [];
      const files = Array.isArray(caseObj.files ?? item.files) ? (caseObj.files ?? item.files) : [];

      const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = safeValue(val);
      };
      setText("case-title", caseObj.title);
      setText("case-serial", caseObj.serial.toString());
      setText("case-created-by", user.first_name ?? user.username);
      setText("case-field", caseObj.field);
      setText("case-against", `${caseObj.against} - ${caseObj.against_type}`);

      const createdAt = caseObj.created_at ? new Date(caseObj.created_at) : null;
      const createdAtText = createdAt && !isNaN(createdAt)
        ? createdAt.toLocaleDateString("he-IL")
        : "-";
      setText("case-created-at", createdAtText);

      const factsEl = document.getElementById("case-facts-text");
      if (factsEl) factsEl.textContent = safeValue(caseObj.facts ?? "");

      const statusDot = document.getElementById("case-status-dot");
      if (statusDot) statusDot.classList.add(caseObj.status || "unknown");

      const clientsTbody = document.querySelector("#clientsTable tbody");
      if (clientsTbody) {
        clientsTbody.innerHTML = clients.length === 0
          ? `<tr><td colspan="100%" class="text-muted py-3">אין לקוחות להצגה</td></tr>`
          : clients.map(c => {
            const badge = `<span class="badge-level ${c.level}">${c.level === "main" ? "ראשי" : "משני"}</span>`;
            return `
                            <tr>
                                <td>${safeValue(c.first_name)}</td>
                                <td>${safeValue(c.last_name)}</td>
                                <td>${safeValue(c.id_card_number)}</td>
                                <td>${safeValue(c.phone)}</td>
                                <td>${safeValue(c.email)}</td>
                                <td>${badge}</td>
                            </tr>`;
          }).join("");
      }

      const eventsTbody = document.querySelector("#eventsTable tbody");
      if (eventsTbody) {
        const evts = caseObj.events ?? item.events ?? [];
        eventsTbody.innerHTML = evts.length === 0
          ? `<tr><td colspan="100%" class="text-muted py-3">אין אירועים להצגה</td></tr>`
          : evts.map(e => `
                        <tr>
                            <td>${safeValue(new Date(e.date).toLocaleDateString("he-IL"))}</td>
                            <td>${safeValue(e.type)}</td>
                            <td>${safeValue(e.description)}</td>
                            <td>${safeValue(e.performed_by)}</td>
                        </tr>`).join("");
      }

      window.__allFiles = files;
      buildFileTypesDropdown(files);
      loadFiles();
    })
    .finally(() => {
      if (Array.isArray(window.__allFiles) && window.__allFiles.length > 0) {
        const filterBar = document.querySelector(".filter-bar");
        filterBar?.classList.remove("loading");
        window.Tables.setFilterBarLoading(filterBar, false);
      }

    });
};

async function viewFile(caseSerial, fileSerial, fileName) {
  try {
    const payload = await window.API.getJson(`/get_file_url?case_serial=${encodeURIComponent(caseSerial)}&file_serial=${encodeURIComponent(fileSerial)}&file_name=${encodeURIComponent(fileName)}`);
    if (!payload?.success || !payload.data) {
      alert("לא ניתן לצפות בקובץ כרגע");
      return;
    }
    const url = payload.data;
    window.open(url, "_blank");

  } catch {
    alert("שגיאה בעת פתיחת הקובץ");
  }
}

window.deleteFile = async function deleteFile(caseSerial, fileSerial, fileName) {
  if (!confirm(`האם אתה בטוח שברצונך למחוק את הקובץ "${fileName}"?`)) return;

  try {
    const url = `/delete_file?case_serial=${caseSerial}&file_serial=${fileSerial}&file_name=${encodeURIComponent(fileName)}`;
    const res = await window.API.apiRequest(url, { method: "DELETE" });
    const data = await res.json();

    if (!data.success) {
      alert(`שגיאה במחיקה: ${data.error || "Error"}`);
      return;
    }

    const row = document.querySelector(`tr[data-file-serial="${fileSerial}"]`);
    if (row) row.remove();

    alert("הקובץ נמחק בהצלחה.");
  } catch {
    alert("שגיאה בתקשורת עם השרת.");
  }
};

function buildFileTypesDropdown(files) {
  const select = document.getElementById("file-type");
  if (!select) return;

  const types = [...new Set(files.map(f => f.content_type))].sort();
  select.innerHTML = `<option value="">סוג</option>` +
    types.map(t => `<option value="${t}">${t}</option>`).join("");
}

function buildFilters() {
  return {
    search: document.getElementById("file-search")?.value.trim() || "",
    type: document.getElementById("file-type")?.value.trim() || ""
  };
}

window.clearFileFilters = function () {
  document.getElementById("file-search").value = "";
  document.getElementById("file-type").value = "";
  loadFiles();
};

let filesTableInstance = null;

window.loadFiles = function loadFiles() {

  const tbody = document.querySelector("#filesTable tbody");
  const files = window.__allFiles || [];
  const filters = buildFilters();

  let filtered = files;

  if (filters.search) {
    filtered = filtered.filter(f =>
      utils.removeExtension(f.name).toLowerCase().includes(filters.search.toLowerCase())
    );
  }

  if (filters.content_type) {
    filtered = filtered.filter(f => f.content_type === filters.content_type);
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="100%" class="text-muted py-3">לא נמצאו קבצים</td></tr>`;
    return;
  }

  if (filesTableInstance) {
    filesTableInstance.clear().destroy();
    filesTableInstance = null;
  }

  tbody.innerHTML = filtered.map(f => {
    const date = f.created_at
      ? new Date(f.created_at).toLocaleDateString("he-IL")
      : "-";
    const icon = utils.fileIconPath(f.technical_type);

    return `
        <tr data-file-serial="${f.serial}"
            onclick="viewFile(${f.case_serial || 0}, ${f.serial}, '${f.name}')">

            <td class="file-name-cell col-wide">
                <img src="${icon}" class="file-icon" />
                ${utils.removeExtension(f.name)}
            </td>

            <td>${date}</td>

            <td>
                <button class="btn btn-sm btn-outline-danger"
                    onclick="event.stopPropagation(); deleteFile(${f.case_serial || 0}, ${f.serial}, '${f.name}')">
                    מחק
                </button>
            </td>
        </tr>`;
  }).join("");

  const tableApi = window.Tables.createHebrewTable("#filesTable", {
    dom: "lrtip",
    columnDefs: [
      { orderable: true, targets: [0, 1] },
      { orderable: false, targets: [2] }
    ]
  });
  filesTableInstance = tableApi.dt;

};