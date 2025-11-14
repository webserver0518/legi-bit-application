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
  const table = $("#casesTable");
  const tbody = table.find("tbody");
  let dataTableInstance = null;

  let CURRENT_ROWS = [];

  // -----------------------
  // LOAD CASES FROM SERVER
  // -----------------------
  function loadCases() {
    document.querySelectorAll(".filter-bar input, .filter-bar select, .filter-bar button")
      .forEach(el => el.disabled = true);

    const url = `/get_office_cases?expand=true`;

    fetch(url)
      .then(r => r.json())
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

        // Superstring for each case
        rows.forEach(obj => {
          const c = obj.cases || obj;
          c.__super = caseToSuperString(c);
        });

        renderCases(rows);
      })
      .catch(err => {
        console.error("Error loading cases:", err);
        tbody.html(
          `<tr><td colspan="100%" class="text-center text-danger py-3">Load error</td></tr>`
        );
      })
      .finally(() => {
        // 🔓 נפתח את הסינון בכל מקרה
        document.querySelectorAll(".filter-bar input, .filter-bar select, .filter-bar button")
          .forEach(el => el.disabled = false);
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
    .addEventListener("input", applyCaseFilters);

  document
    .getElementById("case-status")
    .addEventListener("change", applyCaseFilters);

  // -----------------------
  // RENDER TABLE
  // -----------------------
  function renderCases(list) {
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

    dataTableInstance = table.DataTable({
      paging: true,
      searching: false,
      ordering: true,
      info: false,
      lengthChange: false,
      pageLength: 14,
      dom: "lrtip",
      language: {
        paginate: {
          previous: 'הקודם',
          next: 'הבא'
        }
      }
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
  sessionStorage.setItem("selectedCaseSerial", serial);
  loadContent("view_case", true, "user");
}

function safeValue(v) {
  return v && v.trim && v.trim() !== "" ? v : "-";
}
