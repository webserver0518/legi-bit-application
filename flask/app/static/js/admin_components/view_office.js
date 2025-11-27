// static/js/user_components/view_office.js

window.init_view_office = async function () {
  await window.utils.waitForDom();

  const officeSerial = (window.Recents.get('office') || [])[0];
  if (!officeSerial) {
    window.Toast?.warning?.("לא נבחר משרד אחרון (Recents ריק)");
    return;
  }

  // כותרת עמוד (יש לך #office-name ב-HTML)
  // view_office.html: <span id="office-name">---</span>
  // :contentReference[oaicite:9]{index=9}
  const title = window.Recents.getOfficeTitle(officeSerial) || `משרד #${officeSerial}`;
  const officeNameEl = document.getElementById("office-name");
  if (officeNameEl) officeNameEl.textContent = window.utils.safeValue(title);

  // טבלת משתמשים (ב-HTML שלך זה עדיין id="clientsTable", נשאיר ככה)
  const tbody = document.querySelector("#clientsTable tbody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="100%" class="text-muted py-3">טוען...</td></tr>`;
  }

  // לפי הבקאנד שלך: /get_office_users מחזיר data = מערך משתמשים
  const payload = await window.API.getJson("/get_office_users");
  if (!payload?.success) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="100%" class="text-danger py-3">${window.utils.safeValue(payload?.error || "שגיאה בטעינה")}</td></tr>`;
    return;
  }

  const users = Array.isArray(payload.data) ? payload.data : [];

  if (!users.length) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="100%" class="text-muted py-3">אין משתמשים להצגה</td></tr>`;
    return;
  }

  if (tbody) {
    tbody.innerHTML = users.map(user => {

      const created = u?.created_at ? new Date(u.created_at).toLocaleDateString("he-IL") : "-";

      return `
        <tr>
          <td>${window.utils.safeValue(user.username)}</td>
          <td>${window.utils.safeValue(user.roles.join(", "))}</td>
          <td>${window.utils.safeValue(created)}</td>
        </tr>
      `;
    }).join("");
  }
};