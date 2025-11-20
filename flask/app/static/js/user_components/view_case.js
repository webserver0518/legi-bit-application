
// static/js/user_components/view_case.js

window.init_view_case = async function () {
  await window.utils.waitForDom();

  const navStore = window.Core.storage.create("navigation");
  const lastViewedCase = navStore.get("lastViewedCase") || {};

  window.filesTableInstance ??= null;

  document.getElementById("clear-file-filters")?.addEventListener("click", () => {
    clearFileFilters();
    window.loadFiles();
  });

  const onFilterChange = () => window.loadFiles();
  document.getElementById("file-search")?.addEventListener("input", onFilterChange);
  document.getElementById("file-tech-type")?.addEventListener("change", onFilterChange);
  document.getElementById("file-content-type")?.addEventListener("change", onFilterChange);
  document.getElementById("file-client")?.addEventListener("change", onFilterChange);

  const serial = lastViewedCase.serial
  if (!serial) return;

  const filterBar = document.querySelector(".filter-bar");
  window.Tables.setFilterBarLoading(filterBar, true);

  window.API.getJson(`/get_case?serial=${encodeURIComponent(serial)}&expand=true`)
    .then(payload => {

      if (!payload?.success || !payload?.data?.length) return;
      console.log("View Case Payload:", payload);

      const item = payload.data[0] ?? {};
      const caseObj = item.cases;

      const user = caseObj.user;
      const clients = caseObj.clients;
      const files = caseObj.files;

      const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = window.utils.safeValue(val);
      };
      setText("case-title", caseObj.title);
      setText("case-serial", caseObj.serial.toString());
      setText("case-created-by", user.username);
      setText("case-responsible", caseObj.responsible.username);
      setText("case-field", caseObj.field);
      setText("case-against", `${caseObj.against} - ${caseObj.against_type}`);

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

      const eventsTbody = document.querySelector("#eventsTable tbody");
      if (eventsTbody) {
        const evts = caseObj.events ?? item.events ?? [];
        eventsTbody.innerHTML = evts.length === 0
          ? `<tr><td colspan="100%" class="text-muted py-3">אין אירועים להצגה</td></tr>`
          : evts.map(e => `
              <tr>
                  <td>${window.utils.safeValue(new Date(e.date).toLocaleDateString("he-IL"))}</td>
                  <td>${window.utils.safeValue(e.type)}</td>
                  <td>${window.utils.safeValue(e.description)}</td>
                  <td>${window.utils.safeValue(e.performed_by)}</td>
              </tr>`).join("");
      }

      window.__caseClients = clients;
      window.__allFiles = files;
      window.buildFileTypesDropdown(files);
      window.loadFiles();

      window.initViewCaseUploader(caseObj.serial);
    })
    .finally(() => {
      if (Array.isArray(window.__allFiles) && window.__allFiles.length > 0) {
        const filterBar = document.querySelector(".filter-bar");
        if (filterBar) {
          filterBar.classList.remove("loading");
          window.Tables.setFilterBarLoading(filterBar, false);
        }
      }

    });
};

async function viewFile(caseSerial, fileSerial, fileName) {
  try {
    const payload = await window.API.getJson(`/get_file_url?case_serial=${encodeURIComponent(caseSerial)}&file_serial=${encodeURIComponent(fileSerial)}&file_name=${encodeURIComponent(fileName)}`);
    if (!payload?.success || !payload.data) {
      alert("לא ניתן לצפות בקובץ כרגע");
      return;
    }
    const url = payload.data;
    window.open(url, "_blank");

  } catch {
    alert("שגיאה בעת פתיחת הקובץ");
  }
}

async function deleteFile(caseSerial, fileSerial, fileName) {
  if (!confirm(`האם אתה בטוח שברצונך למחוק את הקובץ "${fileName}"?`)) return;

  try {
    const url = `/delete_file?case_serial=${caseSerial}&file_serial=${fileSerial}&file_name=${encodeURIComponent(fileName)}`;
    const res = await window.API.apiRequest(url, { method: "DELETE" });
    const data = await res.json();

    if (!data.success) {
      alert(`שגיאה במחיקה: ${data.error || "Error"}`);
      return;
    }

    const row = document.querySelector(`tr[data-file-serial="${fileSerial}"]`);
    if (row) row.remove();

    alert("הקובץ נמחק בהצלחה.");
  } catch {
    alert("שגיאה בתקשורת עם השרת.");
  }
};

function getShortTechLabel(mime) {
  if (!mime) return "אחר";

  const m = String(mime).toLowerCase();

  if (m.includes("pdf")) return "PDF";
  if (m.includes("word")) return "Word";
  if (m.includes("excel") || m.includes("spreadsheet")) return "Excel";
  if (m.startsWith("image/")) return "תמונה";
  if (m.startsWith("video/")) return "וידאו";
  if (m.startsWith("audio/")) return "אודיו";
  if (m.includes("zip") || m.includes("rar") || m.includes("7z")) return "ארכיון";

  return "אחר";
}


function buildFileTypesDropdown(files) {
  const techSelect = document.getElementById("file-tech-type");
  const contentSelect = document.getElementById("file-content-type");
  const clientSelect = document.getElementById("file-client");

  const techTypes = [...new Set(
    (files || []).map(f => f.technical_type).filter(Boolean)
  )].sort();

  const contentTypes = [...new Set(
    (files || []).map(f => f.content_type).filter(Boolean)
  )].sort();

  // 🔹 סוג טכני
  if (techSelect) {
    techSelect.innerHTML =
      `<option value="">כל סוגי הקובץ (טכני)</option>` +
      techTypes.map(t => `<option value="${t}">${window.utils.safeValue(formatTechType(t))}</option>`).join("");
  }

  // 🔹 סוג תוכן
  if (contentSelect) {
    contentSelect.innerHTML =
      `<option value="">כל סוגי התוכן</option>` +
      contentTypes.map(t => `<option value="${t}">${window.utils.safeValue(t)}</option>`).join("");
  }

  // 🔹 שיוך ללקוח – רק לקוחות שיש להם לפחות קובץ אחד
  if (clientSelect) {
    const options = window.__caseClients
      .filter(c =>
        (files || []).some(f => String(f.client_serial || "") === String(c.serial))
      )
      .map(c => {
        const label =
          [c.first_name, c.last_name].filter(Boolean).join(" ") ||
          c.id_card_number ||
          c.serial;
        return `<option value="${c.serial}">${window.utils.safeValue(label)}</option>`;
      });

    clientSelect.innerHTML =
      `<option value="">כל הלקוחות</option>` + options.join("");
  }
}

function buildFilters() {
  return {
    search: document.getElementById("file-search")?.value.trim() || "",
    techType: document.getElementById("file-tech-type")?.value.trim() || "",
    contentType: document.getElementById("file-content-type")?.value.trim() || "",
    clientSerial: document.getElementById("file-client")?.value.trim() || ""
  };
}

function clearFileFilters() {
  const searchEl = document.getElementById("file-search");
  const techEl = document.getElementById("file-tech-type");
  const contentEl = document.getElementById("file-content-type");
  const clientEl = document.getElementById("file-client");

  if (searchEl) searchEl.value = "";
  if (techEl) techEl.value = "";
  if (contentEl) contentEl.value = "";
  if (clientEl) clientEl.value = "";

  window.loadFiles();
};

function formatTechType(mime) {
  if (!mime) return "-";
  const m = String(mime).toLowerCase();

  if (m.includes("pdf")) return "PDF";
  if (m.includes("word")) return "Word";
  if (m.includes("excel") || m.includes("spreadsheet")) return "Excel";
  if (m.startsWith("image/")) return "תמונה";
  if (m.startsWith("video/")) return "וידאו";
  if (m.startsWith("audio/")) return "אודיו";
  if (m.includes("zip") || m.includes("rar") || m.includes("7z")) return "ארכיון";

  return mime;
}

function buildFileSuperString(file, client) {
  const parts = [];
  const push = (v) => {
    if (v == null) return;
    const s = String(v).trim();
    if (s) parts.push(s);
  };

  // שם קובץ
  push(file.name);
  push(window.utils.removeExtension(file.name || ""));

  // תיאור
  push(file.description);

  // סוגים
  push(file.technical_type);
  push(file.content_type);

  // פרטי לקוח (אם קיים)
  if (client) {
    push(client.first_name);
    push(client.last_name);
    push(client.id_card_number);
    push(client.phone);
    push(client.email);
  }

  // תאריך העלאה
  if (file.created_at) {
    const d = new Date(file.created_at);
    if (!isNaN(d)) {
      push(d.toLocaleDateString("he-IL"));
    }
  }

  return parts.join("\n").toLowerCase();
}


function loadFiles() {

  const tbody = document.querySelector("#filesTable tbody");
  const files = window.__allFiles || [];
  const filters = window.buildFilters();

  let filtered = files;

  // נבנה map של לקוחות לפי serial
  const clients = Array.isArray(window.__caseClients) ? window.__caseClients : [];
  const clientsBySerial = new Map(clients.map(c => [String(c.serial), c]));

  if (filters.search) {
    const tokens = filters.search.toLowerCase().split(/\s+/).filter(Boolean);

    filtered = filtered.filter(f => {
      const client = clientsBySerial.get(String(f.client_serial || "")) || null;

      // נשתמש בקאשינג על האובייקט עצמו כדי לא לבנות כל פעם מחדש
      if (!f.__super) {
        f.__super = buildFileSuperString(f, client);
      }

      const text = f.__super;
      return tokens.every(t => text.includes(t));
    });
  }

  // 🔹 סינון לפי סוג טכני
  if (filters.techType) {
    filtered = filtered.filter(f => f.technical_type === filters.techType);
  }

  // 🔹 סינון לפי סוג תוכן
  if (filters.contentType) {
    filtered = filtered.filter(f => f.content_type === filters.contentType);
  }

  // 🔹 סינון לפי שיוך לקוח
  if (filters.clientSerial) {
    filtered = filtered.filter(
      f => String(f.client_serial || "") === filters.clientSerial
    );
  }

  if (window.filesTableInstance) {
    window.filesTableInstance.clear().destroy();
    window.filesTableInstance = null;
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="100%" class="text-muted py-3">לא נמצאו קבצים</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(f => {

    const date = f.created_at
      ? new Date(f.created_at).toLocaleDateString("he-IL")
      : "-";

    const icon = window.utils.fileIconPath
      ? window.utils.fileIconPath(f.technical_type)
      : "";

    const client = clientsBySerial.get(String(f.client_serial || "")) || null;
    const clientLabel = client
      ? (
        [client.first_name, client.last_name].filter(Boolean).join(" ") ||
        client.id_card_number ||
        client.serial
      )
      : "לא משויך";

    const techLabel = formatTechType(f.technical_type);

    return `
        <tr data-file-serial="${f.serial}"
            onclick="window.viewFile(${f.case_serial || 0}, ${f.serial}, '${f.name}')">

            <td class="file-name-cell col-wide">
                ${icon ? `<img src="${icon}" class="file-icon" />` : ""}
                ${window.utils.removeExtension(f.name)}
            </td>

            <td>${window.utils.safeValue(f.description ?? "")}</td>
            <td>${window.utils.safeValue(techLabel)}</td>
            <td>${window.utils.safeValue(f.content_type ?? "")}</td>
            <td>${window.utils.safeValue(clientLabel)}</td>

            <td>${date}</td>

            <td>
                <button class="btn btn-sm btn-outline-danger"
                    onclick="event.stopPropagation(); window.deleteFile(${f.case_serial || 0}, ${f.serial}, '${f.name}')">
                    מחק
                </button>
            </td>
        </tr>`;
  }).join("");

  const tableApi = window.Tables.createHebrewTable("#filesTable", {
    dom: "lrtip",
    columnDefs: [
      // מותר למיין לפי: שם + תאריך
      { orderable: true, targets: [0, 5] },
      // שאר העמודות לא ניתנות למיון
      { orderable: false, targets: [1, 2, 3, 4, 6] }
    ]
  });
  window.filesTableInstance = tableApi.dt;

};



















window.vcFilesList = [];

window.initViewCaseUploader = function initViewCaseUploader(caseSerial) {
  const dropArea = document.getElementById("vc-drop-area");
  const pickInput = document.getElementById("vc-fileElem");
  const tbody = document.querySelector("#vc-newFilesTable tbody");
  const uploadBtn = document.getElementById("vc-upload-btn");

  if (!dropArea || !pickInput || !tbody || !uploadBtn) return;

  // למנוע כפילות חיבורים אם הדף נטען מחדש/נרנדר שוב
  if (dropArea.dataset.ready === "1") return;
  dropArea.dataset.ready = "1";

  // reset list if needed
  window.vcFilesList = [];

  function vcToggleQueue() {
    const table = document.getElementById("vc-newFilesTable");
    const btn = document.getElementById("vc-upload-btn");
    const empty = (window.vcFilesList?.length || 0) === 0;
    if (table) table.classList.toggle("d-none", empty);
    if (btn) btn.classList.toggle("d-none", empty);
  }
  vcToggleQueue();

  // ---- Drag&Drop wiring (כמו add_case) ----
  const stop = e => { e.preventDefault(); e.stopPropagation(); };
  ["dragenter", "dragover", "dragleave", "drop"].forEach(ev =>
    dropArea.addEventListener(ev, stop, false)
  );
  dropArea.addEventListener("click", () => pickInput.click());
  dropArea.addEventListener("dragover", () => dropArea.classList.add("highlight"));
  dropArea.addEventListener("dragleave", () => dropArea.classList.remove("highlight"));
  dropArea.addEventListener("drop", (e) => {
    dropArea.classList.remove("highlight");
    if (e.dataTransfer?.files?.length) vcAddFiles(e.dataTransfer.files);
  });
  pickInput.addEventListener("change", () => {
    if (pickInput.files?.length) vcAddFiles(pickInput.files);
    pickInput.value = ""; // לאפשר בחירה חוזרת
  });

  function vcAddFiles(list) { [...list].forEach(f => vcAddRow(f)); ensurePlaceholder(); }

  function ensurePlaceholder() {
    if (window.vcFilesList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="100%" class="text-muted py-3">לא נבחרו קבצים.</td></tr>`;
    } else {
      // אם יש לפחות שורה אחת אמיתית – ודא שאין placeholder
      const alone = tbody.querySelectorAll("tr").length === 1 &&
        tbody.querySelector("td[colspan]") != null;
      if (alone) tbody.innerHTML = "";
    }
    vcToggleQueue();
  }

  async function vcAddRow(file) {
    // אם זו השורה הראשונה – ננקה placeholder
    ensurePlaceholder();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="text-start">${window.utils.safeValue(file.name)}</td>
      <td>
        <select class="form-select form-select-sm vc-content-type">
          <option>טוען...</option>
        </select>
      </td>
      <td>
        <input type="text" class="form-control form-control-sm vc-description" placeholder="תיאור הקובץ">
      </td>
      <td>
        <select class="form-select form-select-sm vc-client">
          <option value="">לא משויך</option>
        </select>
      </td>
      <td>
        <div class="progress" style="height:6px;">
          <div class="progress-bar" role="progressbar" style="width:0%;"></div>
        </div>
      </td>
      <td class="text-center">
        <button type="button" class="btn btn-sm btn-outline-danger vc-remove">✖</button>
      </td>
    `;
    tbody.appendChild(tr);

    // מבנה רשומה פנימית (תואם add_case.js)
    const entry = {
      file,
      technical_type: file.type || "application/octet-stream",
      content_type: null,
      description: "",
      client_serial: "",
      status: "pending",
      key: null,
      serial: null,
      row: tr
    };
    window.vcFilesList.push(entry);

    // מילוי סוגי תוכן (כמו add_case)
    try {
      const res = await window.API.getJson("/get_document_types");
      const types = Array.isArray(res?.data) ? res.data : [];
      const select = tr.querySelector(".vc-content-type");
      select.innerHTML = "";
      types.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.value;
        opt.textContent = t.label;
        select.appendChild(opt);
      });
      select.addEventListener("change", () => { entry.content_type = select.value; });
      // ברירת מחדל: הראשון ברשימה (אם קיים)
      if (types[0]?.value) entry.content_type = types[0].value;
      select.value = entry.content_type || "";
    } catch (err) {
      console.error("Failed to load document types", err);
    }

    // מילוי שיוך ללקוח מתוך __caseClients שנשלפו ב-init_view_case
    const clientSel = tr.querySelector(".vc-client");
    clientSel.innerHTML = `<option value="">לא משויך</option>` +
      (Array.isArray(window.__caseClients) ? window.__caseClients.map(c => {
        const label = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.id_card_number || c.serial;
        return `<option value="${c.serial}">${window.utils.safeValue(label)}</option>`;
      }).join("") : "");
    clientSel.addEventListener("change", () => { entry.client_serial = clientSel.value; });

    // שמירת תיאור
    const desc = tr.querySelector(".vc-description");
    desc.addEventListener("input", () => { entry.description = desc.value.trim(); });

    // מחיקת שורה מהתור
    tr.querySelector(".vc-remove").addEventListener("click", () => {
      tr.remove();
      window.vcFilesList = window.vcFilesList.filter(x => x !== entry);
      ensurePlaceholder();
      vcToggleQueue();
    });
  }

  uploadBtn.addEventListener("click", async () => {
    if (!window.vcFilesList.length) {
      window.Toast.warning("לא נבחרו קבצים");
      return;
    }

    uploadBtn.disabled = true;
    uploadBtn.textContent = "מעלה...";

    try {
      // נשלוף office_serial פעם אחת לפני הסבב
      const officeRes = await window.API.getJson("/get_office_serial");
      if (!officeRes?.success || !officeRes.data?.office_serial) {
        throw new Error("Office serial not found");
      }
      const office_serial = officeRes.data.office_serial;

      // העלאה בפועל (מבוסס על uploadAllFilesToS3 ב-add_case.js)
      const { success, uploaded, failed } =
        await uploadAllFilesToS3_VC(window.vcFilesList, office_serial, caseSerial);

      // עדכון התיק עם יוניון קבצים (A: בצד לקוח)
      if (uploaded.length > 0) {
        const existingSerials = (window.__allFiles || []).map(f => f.serial);
        const newSerials = uploaded.map(u => u.serial);
        const union = Array.from(new Set([...existingSerials, ...newSerials]));

        const upd = await window.API.apiRequest(`/update_case?serial=${Number(caseSerial)}`, {
          method: "PATCH",
          body: { files_serials: union }
        });
        if (!upd?.success) {
          window.Toast.danger(upd?.error || "שגיאה בשמירת הקבצים לתיק");
        } else {
          window.Toast.success("הקבצים נשמרו בתיק");
        }
      }

      // רענון טבלת הקבצים הקיימת בדף (ללא ריענון מלא של כל הדף)
      await vcRefreshExistingFiles(caseSerial);

      // ניקוי התור
      window.vcFilesList = [];
      ensurePlaceholder();

      vcToggleQueue();

      // סיכום
      if (failed.length > 0) {
        window.Toast.danger(`חלק מהקבצים נכשלו (${failed.length}).`);
      } else {
        window.Toast.success("העלאה הושלמה בהצלחה");
      }

    } catch (err) {
      console.error(err);
      window.Toast.danger("שגיאה בהעלאה");
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "העלה קבצים";
    }
  });
};

// העלאה בפועל — שכפול לוגיקה מ-add_case.js עם התאמות לדף צפייה
async function uploadAllFilesToS3_VC(files, office_serial, case_serial) {
  const toUpload = (files || []).filter(f => f.status === "pending" || f.status === "failed");
  const uploaded = [];
  const failed = [];
  const timestamp = window.utils.buildLocalTimestamp
    ? window.utils.buildLocalTimestamp()
    : new Date().toISOString();

  for (const entry of toUpload) {
    const { file, row, technical_type, content_type, description, client_serial } = entry;
    const bar = row.querySelector(".progress-bar");

    try {
      // 1) צור רשומת קובץ
      bar.style.width = "10%";
      bar.classList.remove("bg-success", "bg-danger");
      bar.classList.add("bg-info");

      const created = await window.API.postJson("/create_new_file", {
        created_at: timestamp,
        case_serial,
        client_serial,
        name: file.name,
        technical_type,
        content_type,
        description
      });
      if (!created?.success || !created.data) throw new Error(created?.error || "create_new_file failed");
      const file_serial = created.data;
      entry.serial = file_serial;

      // 2) בנה key
      const key = `uploads/${office_serial}/${case_serial}/${file_serial}-${file.name}`;
      entry.key = key;

      // 3) Presign POST
      const pres = await window.API.postJson("/presign/post", {
        file_name: file.name,
        file_type: technical_type || file.type || "application/octet-stream",
        file_size: file.size,
        key
      });
      const { url, fields } = pres?.data?.presigned || {};
      if (!pres?.success || !url) throw new Error(pres?.error || "presign failed");

      // 4) העלאה אמיתית ל-S3
      entry.status = "uploading";
      await new Promise((resolve, reject) => {
        const formData = new FormData();
        Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
        formData.append("file", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            bar.style.width = `${pct}%`;
          }
        };
        xhr.onload = () => {
          if (xhr.status === 204) {
            bar.style.width = "100%";
            bar.classList.remove("bg-info");
            bar.classList.add("bg-success");
            entry.status = "done";
            resolve();
          } else {
            reject(new Error(`Upload failed ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(formData);
      });

      // 5) עדכן סטטוס הרשומה ל-available
      await window.API.apiRequest(`/update_file?serial=${Number(entry.serial)}`, {
        method: "PATCH",
        body: { status: "available" }
      });

      uploaded.push({ name: file.name, key, serial: entry.serial });

    } catch (err) {
      console.error("Upload failed:", file?.name, err);
      bar.classList.remove("bg-info");
      bar.classList.add("bg-danger");
      bar.style.width = "100%";
      entry.status = "failed";

      // ניקוי רשומה שבורה אם נוצר serial
      if (entry.serial) {
        try {
          await window.API.apiRequest(`/delete_file?serial=${Number(entry.serial)}`, { method: "DELETE" });
          entry.serial = null;
        } catch (cleanupErr) {
          console.error("Failed to cleanup failed record:", cleanupErr);
        }
      }
      failed.push({ name: file?.name, serial: entry.serial, key: entry.key });
    }
  }

  return { success: failed.length === 0, uploaded, failed };
}

// טען מחדש רק את רשימת הקבצים + פילטרים (בלי להוסיף מאזינים כפולים)
async function vcRefreshExistingFiles(caseSerial) {
  try {
    const payload = await window.API.getJson(`/get_case?serial=${encodeURIComponent(caseSerial)}&expand=true`);
    if (!payload?.success || !payload?.data?.length) return;
    const item = payload.data[0] ?? {};
    const caseObj = item.cases;
    const files = caseObj.files || [];

    window.__allFiles = files;
    window.buildFileTypesDropdown(files);
    window.loadFiles();
  } catch (err) {
    console.error("vcRefreshExistingFiles failed:", err);
  }
}