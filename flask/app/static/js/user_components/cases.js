// -----------------------
// SUPER STRING BUILDER
// -----------------------
function caseToSuperString(c) {
  let parts = [];

  // שדות אסורים
  const BLOCKED_KEYS = new Set([
    "password",
    "password_hash",
    "password_hashes",
    "passwordHash",
    "passwordHashes",
    "secret",
    "token"
  ]);

  function walk(key, value) {
    if (value == null) return;
    if (key && BLOCKED_KEYS.has(key)) return;

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      parts.push(String(value));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(v => walk(null, v));
      return;
    }

    if (typeof value === "object") {
      Object.entries(value).forEach(([k, v]) => {
        if (!BLOCKED_KEYS.has(k)) walk(k, v);
      });
    }
  }

  walk(null, c);
  return parts.join("\n").toLowerCase();
}

// -----------------------
// MAIN MODULE
// -----------------------
(() => {
  const casesStore = window.Core.storage.create("cases");

  const savedSearch = casesStore.get("search") || "";
  const savedStatus = casesStore.get("status") || "";
  const savedPage = casesStore.get("page");

  document.getElementById("case-search").value = savedSearch;
  document.getElementById("case-status").value = savedStatus;

  const table = $("#casesTable");
  const tbody = table.find("tbody");
  let dataTableInstance = null;

  let CURRENT_ROWS = [];



  // -----------------------
  // LOAD CASES FROM SERVER
  // -----------------------
  function loadCases() {

    // 🔒 נועל את שורת הסינון בזמן טעינה
    const filterBar = document.querySelector(".filter-bar");
    window.Tables.setFilterBarLoading(filterBar, true);

    const url = `/get_office_cases?expand=true&status=active`;

    window.API.getJson(url)
      .then(payload => {
        if (dataTableInstance) {
          dataTableInstance.clear().destroy();
          dataTableInstance = null;
        }

        tbody.html(
          `<tr><td colspan="100%" class="text-muted py-3">Loading...</td></tr>`
        );

        const rows = Array.isArray(payload?.data) ? payload.data : [];
        CURRENT_ROWS = rows;
        buildStatusDropdown(CURRENT_ROWS);

        // Superstring for each case
        rows.forEach(obj => {
          const c = obj.cases || obj;
          c.__super = caseToSuperString(c);
        });

        applyCaseFilters();
      })
      .catch(err => {
        console.error("Error loading cases:", err);
        tbody.html(
          `<tr><td colspan="100%" class="text-center text-danger py-3">Load error</td></tr>`
        );
      })
      .finally(() => {
        const hasCases = (CURRENT_ROWS?.length || 0) > 0;
        // 🔓 רק אם יש תיקים — נפתח את הסינון
        if (hasCases) {
          window.Tables.setFilterBarLoading(filterBar, false);
        }

      });
  }

  // -----------------------
  // CLEAR FILTERS
  // -----------------------
  document.getElementById("clear-filters").addEventListener("click", () => {
    // איפוס שדה חיפוש
    const searchInput = document.getElementById("case-search");
    searchInput.value = "";

    // איפוס סטטוס
    const statusSelect = document.getElementById("case-status");
    statusSelect.value = "";

    // מחיקה מה־storage
    casesStore.remove("search");
    casesStore.remove("status");
    casesStore.remove("page");

    // רנדר מחדש את כל התיקים
    renderCases(CURRENT_ROWS);
  });
  // -----------------------
  // CLIENT-SIDE FILTERS (search + status)
  // -----------------------
  function applyCaseFilters() {
    const search = document
      .getElementById("case-search")
      .value.trim()
      .toLowerCase();

    const status = document.getElementById("case-status")?.value || "";

    let filtered = [...CURRENT_ROWS];

    // 🔍 סינון לפי חיפוש
    if (search) {
      const tokens = search.split(/\s+/).filter(Boolean);
      filtered = filtered.filter(obj => {
        const text = obj.cases.__super || "";
        return tokens.every(t => text.includes(t));
      });
    }

    // 🏷️ סינון לפי סטטוס
    if (status) {
      filtered = filtered.filter(obj => obj.cases.status === status);
    }

    renderCases(filtered);
  }

  document
    .getElementById("case-search")
    .addEventListener("input", () => {
      const v = document.getElementById("case-search").value.trim();
      casesStore.set("search", v);
      applyCaseFilters();
    });

  document
    .getElementById("case-status")
    .addEventListener("change", () => {
      const v = document.getElementById("case-status").value;
      casesStore.set("status", v);
      applyCaseFilters();
    });

  // -----------------------
  // RENDER TABLE
  // -----------------------
  function renderCases(list) {
    const savedPage = casesStore.get("page");

    if (dataTableInstance) {
      dataTableInstance.clear().destroy();
      dataTableInstance = null;
    }

    if (!list.length) {
      tbody.html(
        `<tr><td colspan="100%" class="text-center text-muted py-3">לא נמצאו תיקים</td></tr>`
      );
      return;
    }

    const htmlRows = list
      .map(obj => {
        const c = obj.cases || {};
        const user = c.user || {};
        const isArchived = c.status === "archived";

        let client = {};
        if (Array.isArray(c.clients)) {
          client =
            c.clients.find(cl => cl.level === "main") ||
            c.clients[0] ||
            {};
        }

        const createdDate = c.created_at
          ? new Date(c.created_at).toLocaleDateString("he-IL")
          : "-";

        const statusDot = c.status
          ? `<span class="status-dot ${c.status}"></span>`
          : "-";

        return `
          <tr onclick="storeCaseAndOpen('${c.serial}')">
            <td class="col-wide">${safeValue(c.title)}</td>
            <td>${c.serial}</td>
            <td>${safeValue(c.field ?? c.category)}</td>
            <td>${statusDot}</td>
            <td>${safeValue(client.first_name)}</td>
            <td>${safeValue(client.last_name)}</td>
            <td>${safeValue(client.id_card_number)}</td>
            <td>${safeValue(client.phone)}</td>
            <td>${safeValue(user.first_name ?? user.username)}</td>
            <td>${safeValue(createdDate)}</td>
            <td>${Array.isArray(c.files) ? c.files.length : "0"}</td>
          </tr>
        `;
      })
      .join("");

    tbody.html(htmlRows);

    const tableApi = window.Tables.createHebrewTable(table, {
      dom: "lrtip",
      order: [[1, "desc"]],
    });
    dataTableInstance = tableApi.dt;

    // Restore page from storage
    if (savedPage !== null && !isNaN(savedPage)) {
      dataTableInstance.page(savedPage).draw("page");
    }

    // Save page changes
    dataTableInstance.on("page.dt", () => {
      casesStore.set("page", dataTableInstance.page());
    });
  }

  // -----------------------
  // INITIAL LOAD
  // -----------------------
  loadCases();
})();

// -----------------------
// HELPERS
// -----------------------
function storeCaseAndOpen(serial) {
  const navStore = window.Core.storage.create("navigation");
  navStore.set("lastViewedCase", { serial, timestamp: Date.now() });
  loadContent("view_case", true, "user");
}


// -----------------------
// BUILD STATUS DROPDOWN (Dynamic like files)
// -----------------------
function buildStatusDropdown(rows) {
  const select = document.getElementById("case-status");
  if (!select) return;

  // איתור כל סוגי הסטטוסים הקיימים
  const statuses = [...new Set(
    rows.map(r => r?.cases?.status).filter(Boolean)
  )].sort();

  // מיפוי תצוגה בעברית
  const statusLabels = {
    active: "פתוח",
    archived: "ארכיון"
  };

  // בניית התוכן הדינמי
  select.innerHTML = `<option value="">כל הסטטוסים</option>` +
    statuses.map(s => {
      const label = statusLabels[s] || s;
      return `<option value="${s}">${label}</option>`;
    }).join("");
}