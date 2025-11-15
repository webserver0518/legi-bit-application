/*************************************************
 * core/tables.js – DataTables standard wrappers
 *
 * דרישות:
 *  - jQuery + DataTables טעונים מראש
 * מטרות:
 *  - הגדרות ברירת־מחדל בעברית
 *  - pageLength=14 קבוע
 *  - "filler rows" כדי למנוע קפיצת כפתורי הבא/הקודם
 **************************************************/

export const hebrewLanguage = {
    paginate: { previous: "הקודם", next: "הבא" },
    emptyTable: "אין נתונים להצגה",
    zeroRecords: "לא נמצאו התאמות",
    info: "",
    infoEmpty: "",
    lengthMenu: "",
    search: "",
};

export function setFilterBarLoading(filterBarEl, loading = true) {
    if (!filterBarEl) return;
    filterBarEl.classList.toggle("loading", !!loading);
    const ctrls = filterBarEl.querySelectorAll("input, select, button, textarea");
    ctrls.forEach((el) => (el.disabled = !!loading));
}

function addFillerRows(tableEl, pageLength = 14) {
    const tbody = tableEl.querySelector("tbody");
    if (!tbody) return;

    Array.from(tbody.querySelectorAll("tr.dt-filler")).forEach((tr) => tr.remove());

    const displayedRows = Array.from(tbody.querySelectorAll("tr")).filter(
        (tr) => !tr.classList.contains("dt-filler")
    ).length;

    const toAdd = Math.max(0, pageLength - displayedRows);
    for (let i = 0; i < toAdd; i++) {
        const tr = document.createElement("tr");
        tr.className = "dt-filler";
        const td = document.createElement("td");
        td.innerHTML = "&nbsp;";
        td.colSpan = tableEl.querySelectorAll("thead th").length || 1;
        tr.appendChild(td);
        tbody.appendChild(tr);
    }
}

/**
 * יצירת טבלה סטנדרטית
 * @param {HTMLTableElement|jQuery|string} tableRef
 * @param {object} extraOptions – הגדרות נוספות של DataTables
 * @returns {{ dt: any, destroy: Function, setData: (rows:any[])=>void, redraw: ()=>void }}
 */
export function createHebrewTable(tableRef, extraOptions = {}) {
    const $ = window.jQuery;
    if (!$ || !$.fn || !$.fn.DataTable) {
        console.error("DataTables not found (jQuery/DataTables must be loaded)");
        return { dt: null, destroy() { }, setData() { }, redraw() { } };
    }

    const $table = typeof tableRef === "string" ? $(tableRef) : $(tableRef);
    const tableEl = $table.get(0);

    const options = {
        searching: false,
        lengthChange: false,
        info: false,
        pageLength: 14,
        language: hebrewLanguage,
        ordering: true,
        ...extraOptions,
    };

    if ($.fn.DataTable.isDataTable($table)) {
        const inst = $table.DataTable();
        inst.destroy();
        $table.find("tbody").empty();
    }

    const dt = $table.DataTable(options);

    $table.on("draw.dt", () => addFillerRows(tableEl, options.pageLength));
    addFillerRows(tableEl, options.pageLength);

    return {
        dt,
        destroy() {
            $table.off("draw.dt");
            if ($.fn.DataTable.isDataTable($table)) dt.destroy();
        },
        setData(rows = []) {
            dt.clear();
            if (Array.isArray(rows) && rows.length) dt.rows.add(rows);
            dt.draw();
        },
        redraw() {
            dt.draw(false);
        },
    };
}

export function replaceTableDataPreservePage(dt, rows = []) {
    if (!dt || !dt.page) return;
    const curr = dt.page();
    dt.clear();
    if (rows.length) dt.rows.add(rows);
    dt.draw(false);
    try { dt.page(curr).draw(false); } catch (_) { }
}

export default {
    hebrewLanguage,
    setFilterBarLoading,
    createHebrewTable,
    replaceTableDataPreservePage,
};
