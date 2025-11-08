(() => {
  const table = $('#casesTable');
  const tbody = table.find('tbody');
  let dataTableInstance = null;

  // --- פונקציה שבונה query לפי כל הפילטרים ---
  function buildQueryParams() {
    const params = new URLSearchParams({ expand: true });

    const client = document.getElementById('filter-client')?.value.trim();
    const status = document.getElementById('filter-status')?.value.trim();
    const category = document.getElementById('filter-category')?.value.trim();
    const city = document.getElementById('filter-city')?.value.trim();

    if (client) params.append('client_name', client);
    if (status) params.append('status', status);
    if (category) params.append('category', category);
    if (city) params.append('city', city);

    return params.toString();
  }

  // --- טעינה מהשרת ---
  function loadCases() {
    const url = `/get_office_cases?${buildQueryParams()}`;

    // 🧹 ננקה טבלה קיימת לפני כל טעינה
    if (dataTableInstance) {
      dataTableInstance.clear().destroy();
      dataTableInstance = null;
    }
    tbody.empty(); // מוחק כל תוכן קודם של ה-tbody

    fetch(url)
      .then(r => r.json())
      .then(payload => {
        const rows = Array.isArray(payload?.data) ? payload.data : [];

        if (!payload?.success || rows.length === 0) {
          // אם קיימת טבלת DataTables ישנה – ננקה ונשמיד אותה
          if (dataTableInstance) {
            dataTableInstance.clear().destroy();
            dataTableInstance = null;
          }

          // נוסיף הודעה ידנית
          tbody.html(`
            <tr>
              <td colspan="100%" class="text-center text-muted py-3">
                לא נמצאו תיקים
              </td>
            </tr>
          `);

          // נצא מהפונקציה כדי שלא נאתחל DataTable שוב
          return;
        }

        // בונה שורות HTML מהתוצאות

        const htmlRows = rows.map(obj => {
          const isArchived = obj.cases.status === "archived";
          return `
            <tr class="${isArchived ? 'archived-row' : ''}" onclick="storeCaseAndOpen('${obj.cases.serial}')">
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
          `;
        }).join('');
        tbody.html(htmlRows);

        // אתחול מחדש של DataTable
        if (dataTableInstance) dataTableInstance.destroy();
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
        console.error('❌ Error loading cases:', err);
        tbody.html(`<tr><td colspan="100%" class="text-center text-danger py-3">שגיאה בטעינת הנתונים</td></tr>`);
      });
  }

  // --- כפתור סינון ---
  window.applyFilters = loadCases;

  // --- כפתור ניקוי ---
  window.clearFilters = () => {
    document.querySelectorAll('.filters input, .filters select').forEach(el => el.value = '');
    loadCases();
  };

  // --- טען תיקים בהתחלה ---
  loadCases()
})();

function storeCaseAndOpen(serial) {
  sessionStorage.setItem('selectedCaseSerial', serial);
  loadContent('view_case', true, 'user');
}
