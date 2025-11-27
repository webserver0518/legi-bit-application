// static/js/user_components/cases.js

window.init_search_case = async function () {
  try {
    await window.utils.waitForDom();

    const table = $("#casesTable");
    const tbody = table.find("tbody");
    let dataTableInstance = null;

    let CURRENT_ROWS = [];

    function loadRows() {

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

          const rows = Array.isArray(payload?.data) ? payload.data : [];
          CURRENT_ROWS = rows;
          buildStatusDropdown(CURRENT_ROWS);

          // Superstring for each case
          rows.forEach(obj => {
            const c = obj.cases || obj;
            c.__super = RowToSuperString(c);
          });

          applyFilters();
        })
        .catch(err => {
          console.error("Error loading cases:", err);
          tbody.html(
            `<tr><td colspan="100%" class="text-center text-danger py-3">
            שגיאת טעינה
            </td></tr>`
          );
        })
        .finally(() => {
          // 🔓 רק אם יש תיקים — נפתח את הסינון
          const hasRows = (CURRENT_ROWS?.length || 0) > 0;
          if (hasRows) {
            window.Tables.setFilterBarLoading(filterBar, false);
          }

        });
    }

    function applyFilters() {
      const search = document
        .getElementById("search")
        .value.trim()
        .toLowerCase();

      const status = document.getElementById("status")?.value || "";

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

      renderRows(filtered);
    }

    document.getElementById("search").addEventListener("input", () => {
      applyFilters();
    });

    document.getElementById("status").addEventListener("change", () => {
      applyFilters();
    });

    document.getElementById("clear-filters").addEventListener("click", () => {
      // איפוס שדה חיפוש
      const searchInput = document.getElementById("search");
      searchInput.value = "";

      // איפוס סטטוס
      const statusSelect = document.getElementById("status");
      statusSelect.value = "";

      // רנדר מחדש את כל התיקים
      renderRows(CURRENT_ROWS);
    });

    function renderRows(list) {
      if (dataTableInstance) {
        dataTableInstance.clear().destroy();
        dataTableInstance = null;
      }

      if (!list.length) {
        tbody.html(
          `<tr><td colspan="100%" class="text-center text-muted py-3">לא נמצאו רשומות</td></tr>`
        );
        return;
      }

      const htmlRows = list
        .map(obj => {
          const c = obj.cases || {};
          const responsible = c.responsible || {};

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
          <tr onclick="OpenNewTab('${c.serial}', '${c.title}')">
            <td class="col-wide">${window.utils.safeValue(c.title)}</td>
            <td>${c.serial}</td>
            <td>${window.utils.safeValue(c.field ?? c.category)}</td>
            <td>${statusDot}</td>
            <td>${window.utils.safeValue(client.first_name)}</td>
            <td>${window.utils.safeValue(client.last_name)}</td>
            <td>${window.utils.safeValue(client.id_card_number)}</td>
            <td>${window.utils.safeValue(client.phone)}</td>
            <td>${window.utils.safeValue(responsible.username)}</td>
            <td>${window.utils.safeValue(createdDate)}</td>
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
    }

    loadRows();

    document.getElementById("export-excel").addEventListener("click", () => {
      if (!CURRENT_ROWS.length) {
        window.toast?.show?.("אין רשומות לייצוא", "warning");
        return;
      }

      const rows = CURRENT_ROWS.map(obj => {
        const c = obj.cases || {};
        const client = Array.isArray(c.clients)
          ? (c.clients.find(cl => cl.level === "main") || c.clients[0] || {})
          : {};
        const responsible = c.responsible || {};
        const createdDate = c.created_at
          ? new Date(c.created_at).toLocaleDateString("he-IL")
          : "-";

        return {
          "כותרת": c.title || "",
          "מספר סידורי": c.serial || "",
          "תחום": c.field || c.category || "",
          "סטטוס": c.status || "",
          "שם פרטי": client.first_name || "",
          "שם משפחה": client.last_name || "",
          "ת.ז": client.id_card_number || "",
          "טלפון": client.phone || "",
          "נוצר ע\"י": responsible.username || "",
          "תאריך יצירה": createdDate,
          "מספר קבצים": Array.isArray(c.files) ? c.files.length : 0,
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "תיקים");
      XLSX.writeFile(wb, "cases.xlsx");
    });
  } catch (e) {
    console.error("Error initializing cases component:", e);
  }
};

function OpenNewTab(serial, title) {
  window.Recents.openCase(serial);

  window.Recents.touch('case', serial);
  if (title) window.Recents.setCaseTitle(serial, title);
  window.renderRecentCases();

  // היילייט אם כבר יש לינק:
  const a = document.querySelector(`.sub-sidebar a.recent-case[data-case-serial="${serial}"]`);
  window.Nav.highlightInSidebar(a, 'sub-sidebar');

  // ניווט רגיל:
  window.UserLoader.navigate({ page: 'view_case', force: true });

}

function RowToSuperString(c) {
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

function buildStatusDropdown(rows) {
  const select = document.getElementById("status");
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