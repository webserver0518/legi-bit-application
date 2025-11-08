(() => {
  const table = $('#casesTable');
  const tbody = table.find('tbody');
  let dataTableInstance = null;

  // delay repeated calls while typing
  function debounce(fn, delay = 400) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // build query string from filters
  function buildQueryParams() {
    const params = new URLSearchParams({ expand: true });

    const title = document.getElementById('filter-title')?.value.trim();
    const field = document.getElementById('filter-field')?.value.trim();
    const status = document.getElementById('filter-status')?.value.trim();
    const client = document.getElementById('filter-client')?.value.trim();

    if (title) {
      const tokens = title.split(/[\s-]+/).filter(Boolean);
      for (const token of tokens) params.append('title_tokens', token);
    }
    if (field) params.append('field', field);
    if (status) params.append('status', status);
    if (client) {
      const tokens = client.split(/[\s-]+/).filter(Boolean);
      for (const token of tokens) params.append('client_tokens', token);
    }

    return params.toString();
  }

  // fetch and render cases
  function loadCases() {
    const url = `/get_office_cases?${buildQueryParams()}`;

    if (dataTableInstance) {
      dataTableInstance.clear().destroy();
      dataTableInstance = null;
    }
    tbody.empty().html(`<tr><td colspan="100%" class="text-muted py-3">Loading...</td></tr>`);

    fetch(url)
      .then(r => r.json())
      .then(payload => {
        const rows = Array.isArray(payload?.data) ? payload.data : [];

        if (!payload?.success || rows.length === 0) {
          tbody.html(`<tr><td colspan="100%" class="text-center text-muted py-3">No cases found</td></tr>`);
          return;
        }

        // build table rows
        const htmlRows = rows.map(obj => {
          const c = obj.cases || {};
          const client = c.client || {};
          const user = c.user || {};
          const isArchived = c.status === "archived";

          const createdDate = c.created_at
            ? new Date(c.created_at).toLocaleDateString('he-IL')
            : '-';

          const statusDot = c.status
            ? `<span class="status-dot ${c.status}"></span>`
            : '-';

          return `
            <tr class="${isArchived ? 'archived-row' : ''}" onclick="storeCaseAndOpen('${c.serial}')">
              <td>${c.title ?? '-'}</td>
              <td>${c.serial ?? '-'}</td>
              <td>${c.field ?? c.category ?? '-'}</td>
              <td>${statusDot}</td>
              <td>${client.first_name ?? '-'}</td>
              <td>${client.last_name ?? '-'}</td>
              <td>${client.id_card_number ?? '-'}</td>
              <td>${client.phone ?? '-'}</td>
              <td>${user.first_name ?? user.username ?? '-'}</td>
              <td>${createdDate}</td>
              <td>${Array.isArray(c.files) ? c.files.length : '0'}</td>
            </tr>
          `;
        }).join('');

        tbody.html(htmlRows);

        // init DataTable
        dataTableInstance = table.DataTable({
          paging: true,
          searching: false,
          ordering: true,
          info: true,
          pageLength: 10,
          language: { url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/he.json' }
        });
      })
      .catch(err => {
        console.error('Error loading cases:', err);
        tbody.html(`<tr><td colspan="100%" class="text-center text-danger py-3">Load error</td></tr>`);
      });
  }

  // reset all filters
  window.clearFilters = () => {
    document.querySelectorAll('#filter-title, #filter-field, #filter-status, #filter-client')
      .forEach(el => el.value = '');
    loadCases();
  };

  // responsive search triggers
  const debouncedLoad = debounce(loadCases);
  ['filter-title', 'filter-field', 'filter-status', 'filter-client'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', debouncedLoad);
    el.addEventListener('change', debouncedLoad);
  });

  // initial load
  loadCases();
})();

// open single case page
function storeCaseAndOpen(serial) {
  sessionStorage.setItem('selectedCaseSerial', serial);
  loadContent('view_case', true, 'user');
}
