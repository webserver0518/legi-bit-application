// static/js/user_components/view_case.js
window.init_view_case = function init_view_case() {
  const safeValue = (v) => (v && v.trim && v.trim() !== "" ? v : "-");

  const serial = sessionStorage.getItem("selectedCaseSerial");
  if (!serial) { console.error("❌ No case serial found in sessionStorage"); return; }
  console.log("ℹ️ Loading case with serial:", serial);

  fetch(`/get_case?serial=${encodeURIComponent(serial)}&expand=true`)
    .then(r => r.json())
    .then(payload => {
      if (!payload?.success || !payload?.data?.length) {
        console.error("❌ Case not found or invalid response");
        return;
      }

      // תואם לשתי צורות אפשריות: [{ cases: {...}, ... }] או [{ ... ישירות ... }]
      const item = payload.data[0] ?? {};
      const caseObj = item.cases ?? item;

      const user = caseObj.user ?? item.user ?? caseObj.created_by ?? {};
      const clients = Array.isArray(caseObj.clients ?? item.clients) ? (caseObj.clients ?? item.clients) : [];
      const files = Array.isArray(caseObj.files ?? item.files) ? (caseObj.files ?? item.files) : [];

      // כותרת
      const elSerial = document.getElementById("case-serial");
      const elTitle = document.getElementById("case-title");
      if (elSerial) elSerial.textContent = safeValue(String(caseObj.serial ?? serial));
      if (elTitle) elTitle.textContent = safeValue(caseObj.title);

      // נקודת סטטוס (וודא שיש CSS לסטטוסים)
      const statusDot = document.getElementById("case-status-dot");
      if (statusDot) statusDot.classList.add(caseObj.status || "unknown");

      // פרטים כלליים
      const createdByText = user.first_name ?? user.username ?? "-";
      const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = safeValue(val); };
      setText("case-created-by", createdByText);
      setText("case-field", caseObj.field);
      setText("case-against", caseObj.against + " - " + caseObj.against_type);

      // Created date
      const createdAt = caseObj.created_at ? new Date(caseObj.created_at) : null;
      const createdAtText = (createdAt && !isNaN(createdAt)) ? createdAt.toLocaleDateString("he-IL") : "-";
      setText("case-created-at", createdAtText);

      // Facts block
      const factsEl = document.getElementById("case-facts-text");
      if (factsEl) {
        const facts = caseObj.facts ?? "";
        factsEl.textContent = safeValue(facts);
      }

      // קבצים
      const filesTbody = document.querySelector("#filesTable tbody");
      if (filesTbody) {
        filesTbody.innerHTML = (files.length === 0)
          ? `<tr><td colspan="100%" class="text-muted py-3">אין קבצים להצגה</td></tr>`
          : files.map(f => {
            const date = f.created_at ? new Date(f.created_at).toLocaleDateString("he-IL") : "-";
            return `
                <tr>
                  <td>${safeValue(f.name)}</td>
                  <td>${safeValue(f.type)}</td>
                  <td>${date}</td>
                  <td><button class="btn btn-sm btn-outline-primary" onclick="window.open('${f.url}', '_blank')">צפה</button></td>
                </tr>`;
          }).join("");
      }

      // לקוחות
      const clientsTbody = document.querySelector("#clientsTable tbody");
      if (clientsTbody) {
        clientsTbody.innerHTML = (clients.length === 0)
          ? `<tr><td colspan="100%" class="text-muted py-3">אין לקוחות להצגה</td></tr>`
          : clients.map(c => {
            const badge = `<span class="badge-level ${c.level}">${c.level === "main" ? "ראשי" : "משני"}</span>`;
            return `
                <tr>
                  <td>${safeValue(c.first_name)}</td>
                  <td>${safeValue(c.last_name)}</td>
                  <td>${safeValue(c.id_card_number)}</td>
                  <td>${safeValue(c.phone)}</td>
                  <td>${safeValue(c.email)}</td>
                  <td>${badge}</td>
                </tr>`;
          }).join("");
      }

      // אירועים (אם/כשיהיו)
      const eventsTbody = document.querySelector("#eventsTable tbody");
      if (eventsTbody) {
        const evts = caseObj.events ?? item.events ?? [];
        eventsTbody.innerHTML = (evts.length === 0)
          ? `<tr><td colspan="100%" class="text-muted py-3">אין אירועים להצגה</td></tr>`
          : evts.map(e => `
              <tr>
                <td>${safeValue(new Date(e.date).toLocaleDateString("he-IL"))}</td>
                <td>${safeValue(e.type)}</td>
                <td>${safeValue(e.description)}</td>
                <td>${safeValue(e.performed_by)}</td>
              </tr>`).join("");
      }
    })
    .catch(err => console.error("❌ Error loading case:", err));
};
