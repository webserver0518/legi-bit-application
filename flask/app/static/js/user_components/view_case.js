
// static/js/user_components/view_case.js

window.init_view_case = async function () {
  await window.utils.waitForDom();

  const queue = (window.Recents?.get('case') || []);
  const serial = queue[0];

  window.API.getJson(`/get_case?serial=${encodeURIComponent(serial)}&expand=true`)
    .then(payload => {

      if (!payload?.success || !payload?.data?.length) return;
      console.log("View Case Payload:", payload);

      const item = payload.data[0] ?? {};
      const caseObj = item.cases;

      const user = caseObj.user;
      const clients = caseObj.clients;

      const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = window.utils.safeValue(val);
      };
      setText("case-title", caseObj.title);
      setText("case-serial", caseObj.serial.toString());
      setText("case-created-by", user.username);
      setText("case-responsible", caseObj.responsible.username);
      setText("case-field", caseObj.field);

      const createdAt = caseObj.created_at ? new Date(caseObj.created_at) : null;
      const createdAtText = createdAt && !isNaN(createdAt) ? createdAt.toLocaleDateString("he-IL") : "-";
      setText("case-created-at", createdAtText);

      const factsEl = document.getElementById("case-facts-text");
      if (factsEl) factsEl.textContent = window.utils.safeValue(caseObj.facts ?? "");

      const statusDot = document.getElementById("case-status-dot");
      if (statusDot) statusDot.classList.add(caseObj.status || "unknown");

      const clientsTbody = document.querySelector("#clientsTable tbody");
      if (clientsTbody) {
        clientsTbody.innerHTML = clients.length === 0
          ? `<tr><td colspan="100%" class="text-muted py-3">אין לקוחות להצגה</td></tr>`
          : clients.map(c => {
            return `
              <tr>
                <td>${window.utils.safeValue(c.first_name)}</td>
                <td>${window.utils.safeValue(c.last_name)}</td>
                <td>${window.utils.safeValue(c.legal_role)}</td>
                <td>${window.utils.safeValue(c.id_card_number)}</td>
                <td>${window.utils.safeValue(c.phone)}</td>
                <td>${window.utils.safeValue(c.email)}</td>
                <td>${window.utils.safeValue(c.role)}</td>
              </tr>`;
          }).join("");
      }

    });
};
