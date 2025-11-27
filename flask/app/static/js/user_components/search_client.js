// static/js/user_components/clients.js

window.init_search_client = async function () {
    try {
        await window.utils.waitForDom();

        const table = $("#Table");
        const tbody = table.find("tbody");
        let dataTableInstance = null;

        let CURRENT_ROWS = [];

        function loadRows() {

            // 🔒 נועל את שורת הסינון בזמן טעינה
            const filterBar = document.querySelector(".filter-bar");
            window.Tables.setFilterBarLoading(filterBar, true);

            const url = `/get_office_clients`;

            window.API.getJson(url)
                .then(payload => {
                    if (dataTableInstance) {
                        dataTableInstance.clear().destroy();
                        dataTableInstance = null;
                    }
                    const rows = Array.isArray(payload?.data) ? payload.data : [];
                    CURRENT_ROWS = rows;
                    console.log(CURRENT_ROWS);

                    // Superstring for each
                    rows.forEach(client => {
                        console.log(client);
                        client.__super = RowToSuperString(client);
                    });

                    applyFilters();
                })
                .catch(err => {
                    console.error("Error loading clients:", err);
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

            let filtered = [...CURRENT_ROWS];

            // 🔍 סינון לפי חיפוש
            if (search) {
                const tokens = search.split(/\s+/).filter(Boolean);
                filtered = filtered.filter(obj => {
                    const text = obj.clients.__super || "";
                    return tokens.every(t => text.includes(t));
                });
            }

            renderRows(filtered);
        }

        document.getElementById("search").addEventListener("input", () => {
            applyFilters();
        });

        document.getElementById("clear-filters").addEventListener("click", () => {
            // איפוס שדה חיפוש
            const searchInput = document.getElementById("search");
            searchInput.value = "";

            // רנדר מחדש
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
                .map(client => {

                    const createdDate = client.created_at
                        ? new Date(u.created_at).toLocaleDateString("he-IL")
                        : "-";

                    return `
                    <tr onclick="OpenNewTab('${client.serial}')">
                        <td>${window.utils.safeValue(client.first_name)}</td>
                        <td>${window.utils.safeValue(client.last_name)}</td>
                        <td>${window.utils.safeValue(client.id_card_number)}</td>
                        <td>${window.utils.safeValue(client.city)}</td>
                        <td>${window.utils.safeValue(client.street)}</td>
                        <td>${window.utils.safeValue(client.home_number)}</td>
                        <td>${window.utils.safeValue(client.postal_code)}</td>
                        <td>${window.utils.safeValue(client.email)}</td>
                        <td>${window.utils.safeValue(client.phone)}</td>
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
                window.toast.warning("אין רשומות לייצוא");
                return;
            }

            const rows = CURRENT_ROWS.map(obj => {
                const client = obj.clients || {};

                const createdDate = client.created_at
                    ? new Date(client.created_at).toLocaleDateString("he-IL")
                    : "-";

                return client;
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "לקוחות");
            XLSX.writeFile(wb, "clients.xlsx");
        });
    } catch (e) {
        console.error("Error initializing clients component:", e);
    }
};

function OpenNewTab(serial) {
}

function RowToSuperString(client) {
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

    walk(null, client); client
    return parts.join("\n").toLowerCase();
}