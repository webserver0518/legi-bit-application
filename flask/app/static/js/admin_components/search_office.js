// static/js/user_components/cases.js

window.init_search_office = async function () {
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

      const url = `/get_offices`;

      window.API.getJson(url)
        .then(payload => {
          if (dataTableInstance) {
            dataTableInstance.clear().destroy();
            dataTableInstance = null;
          }

          const rows = Array.isArray(payload?.data) ? payload.data : [];
          CURRENT_ROWS = rows;

          // Superstring for each case
          rows.forEach(office => {
            office.__super = RowToSuperString(office);
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
        filtered = filtered.filter(office => {
          return tokens.every(t => office.__super.includes(t));
        });
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
        .map(office => {

          const createdDate = office.created_at
            ? new Date(office.created_at).toLocaleDateString("he-IL")
            : "-";

          return `
          <tr onclick="OpenNewTab('${office.office_serial}', '${office.office_name}')">
            <td class="col-wide">${window.utils.safeValue(office.office_name)}</td>
            <td>${window.utils.safeValue(office.office_serial)}</td>
            <td>${createdDate}</td>
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

  } catch (e) {
    console.error("Error initializing cases component:", e);
  }
};

function OpenNewTab(serial, title) {
  window.Recents.openCase(serial);

  window.Recents.touch('office', serial);
  if (title) window.Recents.setCaseTitle(serial, title);
  window.renderRecentCases();

  // היילייט אם כבר יש לינק:
  const a = document.querySelector(`.sub-sidebar a.recent-case[data-office-serial="${serial}"]`);
  window.Nav.highlightInSidebar(a, 'sub-sidebar');

  // ניווט רגיל:
  window.AdminLoader.navigate({ page: 'view_office', force: true });

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