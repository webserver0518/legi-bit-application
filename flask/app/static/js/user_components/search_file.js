// static/js/user_components/files.js

window.init_search_file = async function () {
    try {
        await window.utils.waitForDom();

        const table = $("#Table");
        const tbody = table.find("tbody");
        let dataTableInstance = null;

        window.CURRENT_ROWS = [];

        function loadRows() {

            // 🔒 נועל את שורת הסינון בזמן טעינה
            const filterBar = document.querySelector(".filter-bar");
            window.Tables.setFilterBarLoading(filterBar, true);

            const url = `/get_office_files`;

            window.API.getJson(url)
                .then(payload => {
                    if (dataTableInstance) {
                        dataTableInstance.clear().destroy();
                        dataTableInstance = null;
                    }
                    const rows = Array.isArray(payload?.data) ? payload.data : [];
                    window.CURRENT_ROWS = rows;

                    // Superstring for each
                    rows.forEach(file => {
                        file.__super = RowToSuperString(file);
                    });

                    applyFilters();
                })
                .catch(err => {
                    console.error("Error loading file:", err);
                    tbody.html(
                        `<tr><td colspan="100%" class="text-center text-danger py-3">
                    שגיאת טעינה
                    </td></tr>`
                    );
                })
                .finally(() => {
                    // 🔓 רק אם יש תיקים — נפתח את הסינון
                    const hasRows = (window.CURRENT_ROWS?.length || 0) > 0;
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

            let filtered = [...window.CURRENT_ROWS];

            // 🔍 סינון לפי חיפוש
            if (search) {
                const tokens = search.split(/\s+/).filter(Boolean);
                filtered = filtered.filter(f => {
                    const text = f.__super || "";
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
            if (!searchInput) return;
            searchInput.value = "";

            // רנדר מחדש
            renderRows(window.CURRENT_ROWS);
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
                .map(file => {

                    const createdDate = file.created_at
                        ? new Date(file.created_at).toLocaleDateString("he-IL")
                        : "-";

                    return `
                    <tr data-file-serial="${file.serial}" data-case-serial="${file.case_serial || ''}">
                        <td>
                            ${window.utils.getFileIconHTML(file.name)}
                            <a href="#" onclick="return OpenNewTab('${file.serial}')">
                                ${window.utils.safeValue(file.name)}
                            </a>
                        </td>
                        <td class="editable-desc"
                            data-old-value="${window.utils.safeValue(file.description)}">
                                ${window.utils.safeValue(file.description)}
                        </td>
                        <td>${window.utils.safeValue(createdDate)}</td>
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
            if (!window.CURRENT_ROWS.length) {
                window.toast.warning("אין רשומות לייצוא");
                return;
            }

            const rows = window.CURRENT_ROWS.map(file => {

                const createdDate = file.created_at
                    ? new Date(file.created_at).toLocaleDateString("he-IL")
                    : "-";

                return file;
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "קבצים");
            XLSX.writeFile(wb, "files.xlsx");
        });
    } catch (e) {
        console.error("Error initializing files component:", e);
    }
};

function OpenNewTab(serial) {
    try {
        const rec = (window.CURRENT_ROWS || [])
            .find(f => String(f.serial) === String(serial));

        if (!rec) {
            window.toast?.error?.("קובץ לא נמצא");
            return false;
        }

        const caseSerial = rec.case_serial;
        if (!caseSerial) {
            // If we don't have case_serial in the row, we might need to fetch it or fail.
            // But usually it's there.
            window.toast?.error?.("נתוני קובץ חסרים (case_serial)");
            return false;
        }

        const qs = `case_serial=${encodeURIComponent(caseSerial)}&file_serial=${encodeURIComponent(serial)}`;
        const url = `/view_file?${qs}`;

        window.open(url, "_blank", "noopener,noreferrer");

    } catch (e) {
        console.error(e);
        window.toast?.error?.("שגיאה בפתיחת הקובץ");
    }
    return false; // למנוע ניווט <a href="#">
}

function RowToSuperString(file) {
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

    walk(null, file);
    return parts.join("\n").toLowerCase();
}


(function enableInlineEditDescription() {
    const table = document.querySelector(".customTable");
    if (!table) return;

    // דאבל-קליק פותח input
    table.addEventListener("dblclick", (e) => {
        const cell = e.target.closest("td.editable-desc");
        if (!cell) return;

        // אל תפתח editor אם כבר פתוח
        if (cell.querySelector("input")) return;

        const row = cell.closest("tr");
        const fileSerial = row?.dataset?.fileSerial;
        const caseSerial = row?.dataset?.caseSerial || ""; // אם זמין
        const oldValue = cell.textContent.trim();

        // בונה אינפוט
        const input = document.createElement("input");
        input.type = "text";
        input.value = oldValue;
        input.className = "form-control";
        input.style.minWidth = "220px";

        // ריקון והכנסה
        cell.innerHTML = "";
        cell.appendChild(input);
        input.focus();
        input.select();

        // ביטול (ESC)
        input.addEventListener("keydown", (ev) => {
            if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                cell.textContent = oldValue;
                return;
            }
            if (ev.key === "Enter") {
                ev.preventDefault();
                ev.stopPropagation();
                input.blur(); // מפעיל את שמירת ה-blur למטה
            }
        });

        // שמירה (on blur)
        input.addEventListener("blur", async () => {
            const newValue = input.value.trim();

            // לא השתנה? החזר ושלום
            if (newValue === oldValue) {
                cell.textContent = oldValue;
                return;
            }

            // UI: מצב "שומר…"
            cell.textContent = "שומר…";

            try {
                // שלח לשרת – שנה מסלול אם שונה אצלך
                const payload = {
                    file_serial: Number(fileSerial),
                    case_serial: caseSerial ? Number(caseSerial) : undefined,
                    description: newValue
                };

                const res = await window.API.postJson("/update_file_description", payload);

                if (res?.success) {
                    // עדכן UI
                    cell.textContent = newValue;

                    // עדכן גם בזיכרון כדי לשמור סינכרון
                    const arr = (window.CURRENT_ROWS || []);
                    const idx = arr.findIndex(o => String(o.serial) === String(fileSerial));
                    if (idx >= 0) {
                        const f = arr[idx];
                        f.description = newValue;
                    }

                    // פידבק קטן (לא חובה)
                    window.toast?.success?.("התיאור עודכן");
                } else {
                    cell.textContent = oldValue;
                    window.toast?.error?.(res?.message || "נכשל בעדכון התיאור");
                }
            } catch (err) {
                console.error(err);
                cell.textContent = oldValue;
                window.toast?.error?.("שגיאה בעת עדכון התיאור");
            }
        });
    });
})();