
// static/js/user_components/view_case.js

window.init_view_case = async function () {
  await window.utils.waitForDom();

  const navStore = window.Core.storage.create("navigation");
  const lastViewedCase = navStore.get("lastViewedCase") || {};

  window.filesTableInstance ??= null;

  document.getElementById("clear-file-filters")?.addEventListener("click", () => {
    clearFileFilters();
    window.loadFiles();
  });

  const onFilterChange = () => window.loadFiles();
  document.getElementById("file-search")?.addEventListener("input", onFilterChange);
  document.getElementById("file-tech-type")?.addEventListener("change", onFilterChange);
  document.getElementById("file-content-type")?.addEventListener("change", onFilterChange);
  document.getElementById("file-client")?.addEventListener("change", onFilterChange);

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
        if (el) el.textContent = window.utils.safeValue(val);
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
      if (factsEl) factsEl.textContent = window.utils.safeValue(caseObj.facts ?? "");

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
                                <td>${window.utils.safeValue(c.first_name)}</td>
                                <td>${window.utils.safeValue(c.last_name)}</td>
                                <td>${window.utils.safeValue(c.id_card_number)}</td>
                                <td>${window.utils.safeValue(c.phone)}</td>
                                <td>${window.utils.safeValue(c.email)}</td>
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
                            <td>${window.utils.safeValue(new Date(e.date).toLocaleDateString("he-IL"))}</td>
                            <td>${window.utils.safeValue(e.type)}</td>
                            <td>${window.utils.safeValue(e.description)}</td>
                            <td>${window.utils.safeValue(e.performed_by)}</td>
                        </tr>`).join("");
      }

      window.__caseClients = clients;
      window.__allFiles = files;
      window.buildFileTypesDropdown(files);
      window.loadFiles();
    })
    .finally(() => {
      if (Array.isArray(window.__allFiles) && window.__allFiles.length > 0) {
        const filterBar = document.querySelector(".filter-bar");
        if (filterBar) {
          filterBar.classList.remove("loading");
          window.Tables.setFilterBarLoading(filterBar, false);
        }
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

async function deleteFile(caseSerial, fileSerial, fileName) {
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

function getShortTechLabel(mime) {
  if (!mime) return "אחר";

  const m = String(mime).toLowerCase();

  if (m.includes("pdf")) return "PDF";
  if (m.includes("word")) return "Word";
  if (m.includes("excel") || m.includes("spreadsheet")) return "Excel";
  if (m.startsWith("image/")) return "תמונה";
  if (m.startsWith("video/")) return "וידאו";
  if (m.startsWith("audio/")) return "אודיו";
  if (m.includes("zip") || m.includes("rar") || m.includes("7z")) return "ארכיון";

  return "אחר";
}


function buildFileTypesDropdown(files) {
  const techSelect = document.getElementById("file-tech-type");
  const contentSelect = document.getElementById("file-content-type");
  const clientSelect = document.getElementById("file-client");

  const techTypes = [...new Set(
    (files || []).map(f => f.technical_type).filter(Boolean)
  )].sort();

  const contentTypes = [...new Set(
    (files || []).map(f => f.content_type).filter(Boolean)
  )].sort();

  // 🔹 סוג טכני
  if (techSelect) {
    techSelect.innerHTML =
      `<option value="">כל סוגי הקובץ (טכני)</option>` +
      techTypes.map(t => `<option value="${t}">${window.utils.safeValue(formatTechType(t))}</option>`).join("");
  }

  // 🔹 סוג תוכן
  if (contentSelect) {
    contentSelect.innerHTML =
      `<option value="">כל סוגי התוכן</option>` +
      contentTypes.map(t => `<option value="${t}">${window.utils.safeValue(t)}</option>`).join("");
  }

  // 🔹 שיוך ללקוח – רק לקוחות שיש להם לפחות קובץ אחד
  if (clientSelect) {
    const options = window.__caseClients
      .filter(c =>
        (files || []).some(f => String(f.client_serial || "") === String(c.serial))
      )
      .map(c => {
        const label =
          [c.first_name, c.last_name].filter(Boolean).join(" ") ||
          c.id_card_number ||
          c.serial;
        return `<option value="${c.serial}">${window.utils.safeValue(label)}</option>`;
      });

    clientSelect.innerHTML =
      `<option value="">כל הלקוחות</option>` + options.join("");
  }
}

function buildFilters() {
  return {
    search: document.getElementById("file-search")?.value.trim() || "",
    techType: document.getElementById("file-tech-type")?.value.trim() || "",
    contentType: document.getElementById("file-content-type")?.value.trim() || "",
    clientSerial: document.getElementById("file-client")?.value.trim() || ""
  };
}

function clearFileFilters() {
  const searchEl = document.getElementById("file-search");
  const techEl = document.getElementById("file-tech-type");
  const contentEl = document.getElementById("file-content-type");
  const clientEl = document.getElementById("file-client");

  if (searchEl) searchEl.value = "";
  if (techEl) techEl.value = "";
  if (contentEl) contentEl.value = "";
  if (clientEl) clientEl.value = "";

  window.loadFiles();
};

function formatTechType(mime) {
  if (!mime) return "-";
  const m = String(mime).toLowerCase();

  if (m.includes("pdf")) return "PDF";
  if (m.includes("word")) return "Word";
  if (m.includes("excel") || m.includes("spreadsheet")) return "Excel";
  if (m.startsWith("image/")) return "תמונה";
  if (m.startsWith("video/")) return "וידאו";
  if (m.startsWith("audio/")) return "אודיו";
  if (m.includes("zip") || m.includes("rar") || m.includes("7z")) return "ארכיון";

  return mime;
}

function buildFileSuperString(file, client) {
  const parts = [];
  const push = (v) => {
    if (v == null) return;
    const s = String(v).trim();
    if (s) parts.push(s);
  };

  // שם קובץ
  push(file.name);
  push(window.utils.removeExtension(file.name || ""));

  // תיאור
  push(file.description);

  // סוגים
  push(file.technical_type);
  push(file.content_type);

  // פרטי לקוח (אם קיים)
  if (client) {
    push(client.first_name);
    push(client.last_name);
    push(client.id_card_number);
    push(client.phone);
    push(client.email);
  }

  // תאריך העלאה
  if (file.created_at) {
    const d = new Date(file.created_at);
    if (!isNaN(d)) {
      push(d.toLocaleDateString("he-IL"));
    }
  }

  return parts.join("\n").toLowerCase();
}


function loadFiles() {

  const tbody = document.querySelector("#filesTable tbody");
  const files = window.__allFiles || [];
  const filters = window.buildFilters();

  let filtered = files;

  // נבנה map של לקוחות לפי serial
  const clients = Array.isArray(window.__caseClients) ? window.__caseClients : [];
  const clientsBySerial = new Map(clients.map(c => [String(c.serial), c]));

  if (filters.search) {
    const tokens = filters.search.toLowerCase().split(/\s+/).filter(Boolean);

    filtered = filtered.filter(f => {
      const client = clientsBySerial.get(String(f.client_serial || "")) || null;

      // נשתמש בקאשינג על האובייקט עצמו כדי לא לבנות כל פעם מחדש
      if (!f.__super) {
        f.__super = buildFileSuperString(f, client);
      }

      const text = f.__super;
      return tokens.every(t => text.includes(t));
    });
  }

  // 🔹 סינון לפי סוג טכני
  if (filters.techType) {
    filtered = filtered.filter(f => f.technical_type === filters.techType);
  }

  // 🔹 סינון לפי סוג תוכן
  if (filters.contentType) {
    filtered = filtered.filter(f => f.content_type === filters.contentType);
  }

  // 🔹 סינון לפי שיוך לקוח
  if (filters.clientSerial) {
    filtered = filtered.filter(
      f => String(f.client_serial || "") === filters.clientSerial
    );
  }

  if (window.filesTableInstance) {
    window.filesTableInstance.clear().destroy();
    window.filesTableInstance = null;
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="100%" class="text-muted py-3">לא נמצאו קבצים</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(f => {

    const date = f.created_at
      ? new Date(f.created_at).toLocaleDateString("he-IL")
      : "-";

    const icon = window.utils.fileIconPath
      ? window.utils.fileIconPath(f.technical_type)
      : "";

    const client = clientsBySerial.get(String(f.client_serial || "")) || null;
    const clientLabel = client
      ? (
        [client.first_name, client.last_name].filter(Boolean).join(" ") ||
        client.id_card_number ||
        client.serial
      )
      : "לא משויך";

    const techLabel = formatTechType(f.technical_type);

    return `
        <tr data-file-serial="${f.serial}"
            onclick="window.viewFile(${f.case_serial || 0}, ${f.serial}, '${f.name}')">

            <td class="file-name-cell col-wide">
                ${icon ? `<img src="${icon}" class="file-icon" />` : ""}
                ${window.utils.removeExtension(f.name)}
            </td>

            <td>${window.utils.safeValue(f.description ?? "")}</td>
            <td>${window.utils.safeValue(techLabel)}</td>
            <td>${window.utils.safeValue(f.content_type ?? "")}</td>
            <td>${window.utils.safeValue(clientLabel)}</td>

            <td>${date}</td>

            <td>
                <button class="btn btn-sm btn-outline-danger"
                    onclick="event.stopPropagation(); window.deleteFile(${f.case_serial || 0}, ${f.serial}, '${f.name}')">
                    מחק
                </button>
            </td>
        </tr>`;
  }).join("");

  const tableApi = window.Tables.createHebrewTable("#filesTable", {
    dom: "lrtip",
    columnDefs: [
      // מותר למיין לפי: שם + תאריך
      { orderable: true, targets: [0, 5] },
      // שאר העמודות לא ניתנות למיון
      { orderable: false, targets: [1, 2, 3, 4, 6] }
    ]
  });
  window.filesTableInstance = tableApi.dt;

};