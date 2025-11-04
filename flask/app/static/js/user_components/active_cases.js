/* static/js/user_components/active_cases.js */

(() => {
  const tbody = document.querySelector('#activeCasesTable tbody');
  if (!tbody) return;

  fetch('/get_office_active_cases?expand=true')
    .then(r => r.json())
    .then(payload  => {
    //console.log(payload)
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    //console.log(rows)
        if (!payload?.success || rows.length === 0) {
            tbody.innerHTML = `
              <tr>
                <td colspan="100%" class="text-center text-muted py-3">
                  No cases
                </td>
              </tr>`;
            return;
        }
      // Build the table rows dynamically
      tbody.innerHTML = rows.map(obj => `
        <tr onclick="storeCaseAndOpen('${obj.cases.serial}')">

          <td>${obj.cases.serial ?? '-'}</td>
          <td>${obj.cases.user?.serial ?? '-'}</td>
          <td>${obj.cases.title ?? '-'}</td>
          <td>${obj.cases.category ?? '-'}</td>
          <td>${obj.cases.status ?? '-'}</td>


          <td>${obj.cases.client?.first_name ?? '-'}</td>
          <td>${obj.cases.client?.last_name ?? '-'}</td>
          <td>${obj.cases.client?.id_card_number ?? '-'}</td>
          <td>${obj.cases.client?.phone ?? '-'}</td>
          <td>${obj.cases.client?.city ?? '-'}</td>
          <td>${obj.cases.client?.street ?? '-'}</td>
          <td>${obj.cases.client?.street_number ?? '-'}</td>

          <td>${obj.cases.created_at ?? '-'}</td>
          <td>${Array.isArray(obj.cases.files) ? obj.cases.files.length : '-'}</td>
        </tr>
      `).join('');
    })
    .catch(err => {
      console.error('❌ Error loading cases:', err);
      tbody.innerHTML = `
        <tr>
          <td colspan="100%" class="text-center text-danger py-3">
            Error loading data
          </td>
        </tr>`;
    });
})();

function storeCaseAndOpen(serial) {
  sessionStorage.setItem('selectedCaseSerial', serial);
  loadContent('view_case', true, 'user');
}