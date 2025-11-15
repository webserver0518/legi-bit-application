/* tables.js (IIFE, browser globals) */
(function () {
    'use strict';

    const Tables = {};

    const defaultOptions = {
        paging: true,
        searching: false,
        ordering: true,
        info: false,
        lengthChange: false,
        pageLength: 14,
        dom: 'lrtip',
        language: {
            paginate: { previous: 'הקודם', next: 'הבא' },
            emptyTable: 'אין נתונים להצגה'
        }
    };

    Tables.createHebrewTable = function (elOrSelector, options = {}) {
        const el = typeof elOrSelector === 'string' ? document.querySelector(elOrSelector) : elOrSelector;
        if (!el) throw new Error('Tables.createHebrewTable: table element not found');

        // If DataTables is available (jQuery style)
        let dt = null;
        if (window.jQuery && window.jQuery.fn && window.jQuery.fn.DataTable) {
            dt = window.jQuery(el).DataTable(Object.assign({}, defaultOptions, options));
            return {
                dt,
                setData(rows) {
                    dt.clear();
                    if (Array.isArray(rows) && rows.length) dt.rows.add(rows);
                    dt.draw();
                }
            };
        }

        // Fallback: simple tbody renderer
        const tbody = el.querySelector('tbody') || el.appendChild(document.createElement('tbody'));
        function toRow(cells) {
            const tr = document.createElement('tr');
            (cells || []).forEach((html) => {
                const td = document.createElement('td');
                td.innerHTML = html;
                tr.appendChild(td);
            });
            return tr;
        }
        return {
            dt: null,
            setData(rows) {
                tbody.innerHTML = '';
                (rows || []).forEach((cells) => tbody.appendChild(toRow(cells)));
            }
        };
    };

    Tables.setFilterBarLoading = function (filterBar, on) {
        if (!filterBar) return;
        filterBar.classList.toggle('loading', !!on);
        const els = filterBar.querySelectorAll('input, select, button');
        els.forEach((el) => (el.disabled = !!on));
    };

    window.Tables = Tables;
})();
