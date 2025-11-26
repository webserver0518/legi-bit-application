// static/js/user_components/new_case.js

window.init_new_case = function () {
  initFileUploader();          // Initialize drag & drop + file handling
  initAccordionSections();     // Accordion animation logic
  initCaseFormPreview();       // Form submission & validation
  initFieldAutocomplete();     // Field autocomplete
  initClientsManager();        // ✅ Multi-client management
  initRequiredIndicators();    // ✅ Required fields indicators
  initHebrewBirthDatePicker(); // ✅ Birth date input display handling
  initClientAutocomplete();
  initResponsibleAutocomplete();
};

window.caseClientsManager = {
  list: [],

  is_empty() {
    return this.list.length === 0
  },

  add(clientObj) {
    this.list.push(clientObj);
    renderClientsTable();
  },

  remove(serial) {
    this.list = this.list.filter(c => c.serial != serial);
    renderClientsTable();
  },

  serial_exists(serial) {
    return this.list.some(c => c.serial == serial);
  },

  main_role_exists() {
    return this.list.some(c => c.role === "main");
  }

};

window.caseResponsible = null;

function refreshClientSelectOptions() {
  document.querySelectorAll(".file-client_serial").forEach(select => {
    const prevValue = select.value;
    select.innerHTML = `<option value="">לא משויך</option>`;
    window.caseClientsManager.list.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.serial;
      opt.textContent = `${c.first_name} ${c.last_name}`;
      select.appendChild(opt);
    });
    // אם הערך הקודם עדיין קיים – נחזיר אותו
    if ([...select.options].some(o => o.value === prevValue)) {
      select.value = prevValue;
    }
  });
};

async function uploadAllFilesToS3(files, office_serial, case_serial) {
  if (!files || files.length === 0) {
    return {
      success: true,
      uploaded: [],
      failed: []
    };
  }

  // סינון רק קבצים שטרם הועלו או שנכשלו
  const toUpload = files.filter(f => f.status === "pending" || f.status === "failed");
  if (toUpload.length === 0) {
    const uploadedEntries = files.filter(f => f.status === "done");
    const failedEntries = files.filter(f => f.status === "failed");
    return {
      success: failedEntries.length === 0,
      uploaded: uploadedEntries.map(f => ({
        name: f.file.name,
        key: f.key,
        serial: f.serial
      })),
      failed: failedEntries.map(f => ({
        name: f.file.name,
        serial: f.serial,
        key: f.key
      }))
    };
  }

  const timestamp = window.utils.buildLocalTimestamp();

  for (const fileEntry of toUpload) {
    const {
      file,
      row,
      technical_type,
      content_type,
      description,
      client_serial,
      serial,
      status
    } = fileEntry;

    const progressBar = row.querySelector(".progress-bar");

    try {
      // --- 1️⃣ קבלת כתובת חתומה מהשרת ---
      progressBar.style.width = "10%";
      progressBar.classList.remove("bg-success", "bg-danger");
      progressBar.classList.add("bg-info");

      // 1️⃣ צור רשומת קובץ במונגו
      const parsedCreate = await window.API.postJson("/create_new_file", {
        created_at: timestamp,
        case_serial,
        client_serial,
        name: file.name,
        technical_type,
        content_type,
        description,
      });

      if (!parsedCreate.success || !parsedCreate.data) {
        throw new Error(parsedCreate.error || "Failed to create file record");
      }

      const file_serial = parsedCreate.data; // ✅ לפי איך שאתה מחזיר מהשרת
      fileEntry.serial = file_serial;

      // 2️⃣ צור key ייחודי הכולל office, case, file
      const uploadKey = `uploads/${office_serial}/${case_serial}/${file_serial}/${file.name}`;
      fileEntry.key = uploadKey;


      // 3️⃣ בקשת presigned URL ל-S3
      const parsedPresign = await window.API.postJson("/presign/post", {
        file_name: file.name,
        file_type: technical_type || file.type || "application/octet-stream",
        file_size: file.size,
        key: uploadKey
      });
      if (!parsedPresign.success || !parsedPresign.data?.presigned?.url) {
        throw new Error(parsedPresign.error || "Failed to get presigned URL");
      }
      const { url, fields } = parsedPresign.data.presigned;


      // 4️⃣ העלאה אמיתית ל-S3
      fileEntry.status = "uploading";
      const formData = new FormData();
      Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
      formData.append("file", file);

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const percent = Math.round((evt.loaded / evt.total) * 100);
            progressBar.style.width = `${percent}%`;
          }
        };

        xhr.onload = () => {
          if (xhr.status === 204) {
            progressBar.style.width = "100%";
            progressBar.classList.remove("bg-info");
            progressBar.classList.add("bg-success");
            fileEntry.status = "done";
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
            window.Toast.danger(`העלאת "${file.name}" נכשלה`);
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(formData);
      });

      console.log(`Uploaded ${file.name} to S3 (${uploadKey})`);

      await window.API.apiRequest(`/update_file?serial=${Number(fileEntry.serial)}`, {
        method: "PATCH",
        body: { status: "available" }
      });
    } catch (err) {

      progressBar.classList.remove("bg-info");
      progressBar.classList.add("bg-danger");
      progressBar.style.width = "100%";
      fileEntry.status = "failed";

      // 💣 חדש! מוחק את הרשומה שלא מועילה
      // 🗑️ ניקוי רשומה שבורה במונגו (אם נוצר serial)
      if (fileEntry.serial) {
        try {
          await window.API.apiRequest(`/delete_file?serial=${Number(fileEntry.serial)}`, {
            method: "DELETE"
          });
          console.info(`Deleted failed file record: ${fileEntry.serial}`);
          fileEntry.serial = null; // אופציונלי, שלא נעשה עליו שימוש בהמשך
        } catch (cleanupErr) {
          console.error("Failed to delete failed file record", cleanupErr);
        }
      }

      console.error("Upload failed for:", file.name, err);
      window.Toast.danger(`העלאת ${file.name} נכשלה`);
    }
  }

  const uploadedEntries = files.filter(f => f.status === "done");
  const failedEntries = files.filter(f => f.status === "failed");

  return {
    success: failedEntries.length === 0,
    uploaded: uploadedEntries.map(f => ({
      name: f.file.name,
      key: f.key,
      serial: f.serial
    })),
    failed: failedEntries.map(f => ({
      name: f.file.name,
      serial: f.serial,
      key: f.key
    }))
  };
}

window.removeClient = function (serial) {
  window.caseClientsManager.remove(serial);
};

function renderClientsTable() {
  const table = document.getElementById("clients-table");
  const tableBody = table.querySelector("tbody");

  if (window.caseClientsManager.is_empty()) {
    table.style.display = "none"; // או table.classList.add('d-none');
    tableBody.innerHTML = "";
    return;
  }

  // אם יש לקוחות — נציג את הטבלה
  table.style.display = "table";
  tableBody.innerHTML = window.caseClientsManager.list.map((c, i) => `
      <tr>
        <td>${window.utils.safeValue(c.first_name)}</td>
        <td>${window.utils.safeValue(c.last_name)}</td>
        <td>${window.utils.safeValue(c.id_card_number)}</td>
        <td>${window.utils.safeValue(c.phone)}</td>
        <td>${window.utils.safeValue(c.city)}</td>
        <td>${window.utils.safeValue(c.street)}</td >
        <td>${window.utils.safeValue(c.home_number)}</td>
        <td>${window.utils.safeValue(c.postal_code)}</td>
        <td>${window.utils.safeValue(c.email)}</td>
        <td>${window.utils.safeValue(c.birth_date)}</td>
        <td>${window.utils.safeValue(c.role)}</td>
        <td>${window.utils.safeValue(c.legal_role)}</td>
        <td><button class="btn btn-sm btn-outline-danger" onclick="removeClient(${c.serial})">✖</button></td>
      </tr >
  `).join("");

  document.getElementById("clients-json-input").value = JSON.stringify(window.caseClientsManager.list);

  window.refreshClientSelectOptions();
};




// ✅ אחראי על התיק - autocomplete
async function initResponsibleAutocomplete() {
  const input = document.getElementById("responsible-input");
  const suggestions = document.getElementById("responsible-suggestions");
  if (!input || !suggestions) return;

  // נאפס את האחראי הגלובלי
  window.caseResponsible = null;

  let officeUsers = [];
  try {
    const res = await window.API.getJson("/get_office_users");
    if (res.success && Array.isArray(res.data)) {
      console.log(res.data)
      officeUsers = res.data;
    }
  } catch (err) {
    console.error("❌ שגיאה בשליפת משתמשי משרד:", err);
  }

  function renderResponsibleSuggestions(filter = "") {
    const value = filter.trim();

    const matches = value
      ? officeUsers.filter(u =>
        (u.username).includes(value)
      )
      : officeUsers;

    if (matches.length === 0) {
      suggestions.style.display = "none";
      suggestions.innerHTML = "";
      return;
    }

    suggestions.innerHTML = matches
      .map(u => `
        <li class="list-group-item list-group-item-action" data-serial="${u.serial}">
          ${u.username}
        </li>
      `)
      .join("");

    suggestions.style.display = "block";
  }

  // typing
  input.addEventListener("input", () => {
    if (!input.value.trim()) {
      renderResponsibleSuggestions("");
    } else {
      renderResponsibleSuggestions(input.value);
    }
  });

  // focusing
  input.addEventListener("focus", () => {
    renderResponsibleSuggestions(input.value || "");
  });

  // בחירת אחראי קיים
  suggestions.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    const serial = li.dataset.serial;
    const selected = officeUsers.find(u => u.serial == serial);
    if (!selected) return;

    window.caseResponsible = selected;
    input.value = `${selected.username}`;

    window.Toast.success(`נבחר אחראי: ${selected.username}`);

    suggestions.style.display = "none";
  });

  // סגור הצעות בלחיצה בחוץ
  document.addEventListener("click", (e) => {
    if (!suggestions.contains(e.target) && e.target !== input)
      suggestions.style.display = "none";
  });
}

function initFileUploader() {
  const dropArea = document.getElementById('drop-area');
  if (!dropArea || dropArea.dataset.ready) return;
  dropArea.dataset.ready = "1";

  const pickInput = document.getElementById('fileElem');
  const tbody = document.querySelector('#fileTable tbody');

  // ✅ נשתמש במערך גלובלי במקום input מוסתר
  window.filesList = [];
  const nameCount = {};

  // 👇 הצגה/הסתרה של טבלת התור בהתאם לאורך הרשימה
  const tableEl = document.getElementById('fileTable');
  function toggleFilesQueueTable() {
    if (!tableEl) return;
    tableEl.classList.toggle('d-none', (window.filesList?.length || 0) === 0);
  }
  // ברירת מחדל: אין פריטים -> מוסתר (קיים גם ב-HTML), שומרים סנכרון ב-JS:
  toggleFilesQueueTable();

  // למנוע התנהגות דיפולטית של גרירה
  const stop = e => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
    dropArea.addEventListener(ev, stop, false)
  );

  // אירועים על drop area
  dropArea.addEventListener('click', () => pickInput.click());
  dropArea.addEventListener('dragover', () => dropArea.classList.add('highlight'));
  dropArea.addEventListener('dragleave', () => dropArea.classList.remove('highlight'));
  dropArea.addEventListener('drop', e => {
    dropArea.classList.remove('highlight');
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });
  pickInput.addEventListener('change', () => addFiles(pickInput.files));

  // הוספת קבצים לרשימה ולטבלה
  function addFiles(list) {
    [...list].forEach(f => { addRow(f); });
    pickInput.value = '';  // לאפשר בחירה חוזרת
  }

  // מתן שם ייחודי לתצוגה בלבד
  function unique(name) {
    if (nameCount[name] === undefined) {
      nameCount[name] = 0;
      return name;
    }
    nameCount[name] += 1;
    const dot = name.lastIndexOf('.');
    return dot > -1
      ? `${name.slice(0, dot)}_${nameCount[name]}${name.slice(dot)}`
      : `${name}_${nameCount[name]}`;
  }

  async function addRow(file) {
    const disp = unique(file.name);
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${disp}</td>
        <td>
          <select class="form-select form-select-sm file-content-type" name="content_type_${disp}">
            <option>טוען...</option>
          </select>
        </td>
        <td>
          <input type="text" class="form-control form-control-sm file-description" 
                name="description_${disp}" placeholder="תיאור הקובץ">
        </td>
        <td>
          <select class="form-select form-select-sm file-client_serial" name="client_serial_${disp}">
            <option value="">לא משויך</option>
          </select>
        </td>
        <td>
          <div class="progress" style="height: 6px;">
            <div class="progress-bar" role="progressbar" style="width: 0%;"></div>
          </div>
        </td>
        <td class="text-center">
          <button type="button" class="btn btn-sm btn-outline-danger">✖</button>
        </td>
      `;
    tbody.appendChild(tr);

    // ✅ הוספה לרשימה הגלובלית
    window.filesList.push({
      file,
      technical_type: file.type || null,
      content_type: null,
      description: "",
      client_serial: "",
      status: "pending",
      key: null,
      row: tr       // נשתמש בזה כדי לעדכן את ה־progress bar
    });

    toggleFilesQueueTable();

    // טעינת סוגי המסמכים
    try {
      const typesRes = await window.API.getJson("/get_document_types");
      if (!typesRes.success) throw new Error("Failed to load document types");
      const types = Array.isArray(typesRes.data) ? typesRes.data : [];

      const select = tr.querySelector(".file-content-type");
      select.innerHTML = "";
      types.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.value;
        opt.textContent = t.label;
        select.appendChild(opt);
      });
      // עדכון הסוג ברשימה
      select.addEventListener("change", () => {
        const entry = window.filesList.find(f => f.file === file);
        if (entry) entry.content_type = select.value;
      });
    } catch (err) {
      console.error("❌ שגיאה בטעינת סוגי המסמכים:", err);
    }

    // --- טען שיוך ללקוח ---
    const clientSelect = tr.querySelector(".file-client_serial");
    clientSelect.innerHTML = `<option value="">לא משויך</option>`;
    window.caseClientsManager.list.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.serial;
      opt.textContent = `${c.first_name} ${c.last_name}`;
      clientSelect.appendChild(opt);
    });
    clientSelect.addEventListener("change", () => {
      const entry = window.filesList.find(f => f.file === file);
      if (entry) entry.client_serial = clientSelect.value;
    });

    // --- שמירת תיאור ---
    const descInput = tr.querySelector(".file-description");
    descInput.addEventListener("input", () => {
      const entry = window.filesList.find(f => f.file === file);
      if (entry) entry.description = descInput.value.trim();
    });

    tr.querySelector('button').onclick = () => {
      tr.remove();
      window.filesList = window.filesList.filter(f => f.file !== file);
      toggleFilesQueueTable();
    };
  }
}

function initAccordionSections() {
  const headers = document.querySelectorAll(".section-header");
  headers.forEach(header => {
    const targetId = header.getAttribute("data-target");
    const content = document.querySelector(targetId);
    if (!content) return;

    content.style.height = "0";
    content.style.overflow = "hidden";
    content.style.transition = "height 0.5s ease";
    content.classList.remove("show");

    header.addEventListener("click", () => {
      const isOpen = content.classList.contains("show");
      document.querySelectorAll(".accordion-collapse.show").forEach(openItem => {
        if (openItem !== content) {
          openItem.style.height = `${openItem.scrollHeight}px`;
          requestAnimationFrame(() => openItem.style.height = "0");
          openItem.classList.remove("show");
        }
      });
      if (isOpen) {
        content.style.height = `${content.scrollHeight}px`;
        requestAnimationFrame(() => content.style.height = "0");
        content.classList.remove("show");
      } else {
        content.classList.add("show");
        content.style.height = "0";
        requestAnimationFrame(() => content.style.height = `${content.scrollHeight}px`);
        content.addEventListener("transitionend", () => {
          if (content.classList.contains("show")) content.style.height = "auto";
        }, { once: true });
      }
    });
  });
};

function initCaseFormPreview() {
  const form = document.getElementById("addCaseForm");
  if (!form) return;

  const storage = window.Core.storage.create
    ? window.Core.storage.create("cases")
    : null;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // prevent multiple submissions
    const submitBtn = form.querySelector("button[type='submit']");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "יוצר תיק...";
    }

    // ✅ Require at least one main client before submission
    if (!window.caseClientsManager.main_role_exists()) {
      window.Toast.danger("יש להוסיף לפחות לקוח ראשי אחד לפני פתיחת תיק");
      submitBtn.disabled = false;
      submitBtn.textContent = "פתח תיק";
      return;
    }

    const fd = new FormData(form);
    const timestamp = window.utils.buildLocalTimestamp();


    if (!fd.get('title')) {
      window.Toast.danger("יש למלא כותרת לתיק");
      submitBtn.disabled = false;
      submitBtn.textContent = "פתח תיק";
      return;
    }

    const form_data = {
      created_at: timestamp,
      title: fd.get('title'),
      responsible_serial: window.caseResponsible,
      field: fd.get('field'),
      facts: fd.get('facts'),
      against: fd.get('against'),
      against_type: fd.get('against_type'),
      clients_with_roles: window.caseClientsManager.list.map(c => ({
        client_serial: c.serial,
        role: c.role,
        legal_role: c.legal_role
      }))
    };

    // 🟢 שליחת הנתונים לשרת
    try {
      const parsed = await window.API.postJson("/create_new_case", form_data);

      if (!parsed.success || !parsed.data) {
        window.Toast.danger(`Failed to create case: ${parsed.error}`);
        return;
      }
      window.Toast.success("Case created successfully");

      // open files section
      document.querySelector("[data-target='#collapseFiles']")?.click();

      const case_serial = parsed.data;

      // כעת נשלוף את מזהה המשרד
      let office_serial;
      try {
        const parsed = await window.API.getJson("/get_office_serial");

        if (!parsed.success || !parsed.data?.office_serial) {
          throw new Error("Office serial not found");
        }
        office_serial = parsed.data.office_serial;
      } catch {
        submitBtn.disabled = false;
        submitBtn.textContent = "פתח תיק";
        return; // עצור אם לא הצלחנו לקבל מזהה משרד
      }

      if (!window.filesList || window.filesList.length === 0) {
        window.Toast.warning("לא נבחרו קבצים, התיק ייווצר ללא מסמכים");
        const nav = window.Core.storage.create("navigation");
        nav.set("lastViewedCase", { serial: case_serial, timestamp: Date.now() });
        window.UserLoader.navigate({ page: "view_case", force: true });
        return;
      }

      /* 2️⃣ העלאת קבצים עם key לפי office+case */
      window.Toast.info("מעלה קבצים...")
      const { success, uploaded, failed } = await uploadAllFilesToS3(window.filesList, office_serial, case_serial);

      // נשמור בתיק רק את הקבצים שעלו בהצלחה
      if (uploaded.length > 0) {
        window.Toast.info("שומר קבצים...")
        const fileSerials = uploaded.map(f => f.serial);

        const parsedUpdate = await window.API.apiRequest(`/update_case?serial=${case_serial}`, {
          method: "PATCH",
          body: { files_serials: fileSerials }
        });

        if (!parsedUpdate.success) {
          window.Toast.danger(parsedUpdate.error || "שגיאה בשמירת הקבצים לתיק");
        } else {
          window.Toast.success("הקבצים שעלו בהצלחה נשמרו בתיק");
        }
      }

      // אם יש קבצים שנכשלו – טוסט מסכם
      if (failed.length > 0) {
        window.Toast.danger(` חלק מהקבצים לא הועלו (${failed.length}). ניתן לנסות שוב מתוך התיק.`);
      } else if (uploaded.length === 0) {
        // מקרה קיצון: היו קבצים ב-UI אבל אף אחד לא הצליח
        window.Toast.warning("לא היה ניתן להעלות אף קובץ. התיק נוצר ללא קבצים.");
      }

      // בכל מקרה – עוברים לדף צפייה בתיק
      const nav = window.Core.storage.create("navigation");
      nav.set("lastViewedCase", { serial: case_serial, timestamp: Date.now() });
      window.UserLoader.navigate({ page: "view_case", force: true });

    } catch (error) {
      console.error(error);
      window.Toast.warning("Error contacting server");

    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "פתח תיק";
      }
    }

  });
};

async function initFieldAutocomplete() {
  const input = document.getElementById("field-input");
  const suggestions = document.getElementById("field-suggestions");
  if (!input) return;

  try {
    const catRes = await window.API.getJson("/get_case_categories");
    const categories = Array.isArray(catRes.data) ? catRes.data : [];

    function showSuggestions(filter = "") {
      const value = filter.trim();
      suggestions.innerHTML = "";
      const matches = categories.filter(cat => cat.label.includes(value));
      matches.forEach(cat => {
        const li = document.createElement("li");
        li.className = "list-group-item list-group-item-action";
        li.textContent = cat.label;
        li.addEventListener("click", () => {
          input.value = cat.label;
          suggestions.innerHTML = "";
        });
        suggestions.appendChild(li);
      });
    }
    input.addEventListener("input", () => showSuggestions(input.value));
    input.addEventListener("focus", () => showSuggestions(""));
    document.addEventListener("click", (e) => {
      if (!suggestions.contains(e.target) && e.target !== input) suggestions.innerHTML = "";
    });
  } catch (err) {
    console.error("Failed to load categories:", err);
  }
};

function initClientsManager() {
  const addBtn = document.getElementById("add-client-btn");
  const roleSelect = document.getElementById("client_role");
  const legalRoleSelect = document.getElementById("client_legal_role");
  const tableBody = document.querySelector("#clients-table tbody");
  const form = document.getElementById("addCaseForm");

  if (!addBtn || !tableBody) return;

  // ➕ Add client button
  addBtn.addEventListener("click", async () => {
    const fd = new FormData(form);

    const client = {
      first_name: fd.get("client_first_name"),
      last_name: fd.get("client_last_name"),
      id_card_number: fd.get("client_id_card_number"),
      phone: fd.get("client_phone"),
      city: fd.get("client_city"),
      street: fd.get("client_street"),
      home_number: fd.get("client_home_number"),
      postal_code: fd.get("client_postal_code"),
      email: fd.get("client_email"),
      birth_date: fd.get("client_birth_date")
    };

    // ✅ Require minimal client details before adding
    if (!client.first_name) {
      alert("יש למלא שם פרטי לפני הוספת לקוח");
      return;
    }

    try {
      // 🧠 שליחה לשרת כדי לשמור לקוח חדש
      const apiRes = await window.API.postJson("/create_new_client", client);
      if (!apiRes.success) {
        window.Toast.danger("שגיאה בהוספת לקוח לשרת");
        return;
      }

      const client_serial = apiRes.data;
      client.serial = client_serial;
      window.caseClientsManager.add({
        ...client,
        role: roleSelect.value,
        legal_role: legalRoleSelect.value,
      });
      clearClientFields();
      window.Toast.success(`לקוח חדש נוצר ונוסף לתיק (מס' ${client_serial})`);
    } catch (err) {
      console.error("שגיאה בשליחת לקוח:", err);
      window.Toast.warning("בעיה בחיבור לשרת");
    }

  });

  // 🧹 Clear input fields after adding
  function clearClientFields() {
    [
      "client_first_name", "client_last_name", "client_id_card_number", "client_phone",
      "client_city", "client_street", "client_home_number", "client_postal_code",
      "client_email", "client_birth_date"
    ].forEach(id => {
      const el = document.querySelector(`[name='${id}']`);
      if (el) el.value = "";
    });
  }
  renderClientsTable();
}

function initRequiredIndicators() {
  const requiredInputs = document.querySelectorAll('.required-field');

  requiredInputs.forEach(input => {
    const update = () => {
      if (input.value.trim()) {
        input.classList.add('filled');
      } else {
        input.classList.remove('filled');
      }
    };
    input.addEventListener('input', update);
    input.addEventListener('blur', update);
    update(); // להריץ פעם אחת בהתחלה
  });
}

function initHebrewBirthDatePicker() {
  const input = document.getElementById("client-birthdate-input");
  if (!input) return;

  flatpickr(input, {
    locale: "he",
    dateFormat: "d בF Y", // תצוגה עברית יפה
    altInput: true,
    altFormat: "Y-m-d", // הערך שישלח לשרת
    allowInput: true,
    disableMobile: false,
    defaultDate: null,
    onReady(_, __, instance) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "btn btn-outline-secondary btn-sm ms-2";
      clearBtn.textContent = "נקה";
      clearBtn.onclick = () => instance.clear();
      if (instance.calendarContainer) {
        instance.calendarContainer.appendChild(clearBtn);
      }
    }
  });
}

async function initClientAutocomplete() {
  console.log("Initializing client autocomplete...");
  const input = document.getElementById("client-first-name-input");
  const suggestions = document.getElementById("client-name-suggestions");
  if (!input || !suggestions) return;

  let officeClients = [];
  try {
    const res = await window.API.getJson("/get_office_clients");
    if (res.success && Array.isArray(res.data)) {
      officeClients = res.data;
      console.log("Loaded office clients for autocomplete:", officeClients);
    }
  } catch (err) {
    console.error("❌ שגיאה בשליפת לקוחות מהמשרד:", err);
  }

  function renderClientSuggestions(filter = "") {
    const value = filter.trim();

    const matches = value
      ? officeClients.filter(c =>
        (c.first_name + " " + c.last_name).includes(value)
      )
      : officeClients; // focus should show ALL

    if (matches.length === 0) {
      suggestions.style.display = "none";
      suggestions.innerHTML = "";
      return;
    }

    suggestions.innerHTML = matches
      .map(c => `
      <li class="list-group-item list-group-item-action" data-serial="${c.serial}">
        ${c.first_name} ${c.last_name}
      </li>
    `)
      .join("");

    suggestions.style.display = "block";
  }

  // typing
  input.addEventListener("input", () => {
    if (!input.value.trim()) {
      renderClientSuggestions(""); // show all
    } else {
      renderClientSuggestions(input.value);
    }
  });

  // focusing
  input.addEventListener("focus", () => {
    renderClientSuggestions(input.value || "");
  });


  // 🧩 בחירת לקוח קיים → הוספה ישירה לטבלה
  suggestions.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    const serial = li.dataset.serial;
    const selected = officeClients.find(c => c.serial == serial);
    if (!selected) return;

    // בדוק אם כבר בטבלה
    if (window.caseClientsManager.serial_exists(selected.serial)) {
      window.Toast.warning("הלקוח כבר נוסף לתיק");
      suggestions.style.display = "none";
      input.value = "";
      return;
    }

    // הוסף לקוח לרשימה
    const roleSelect = document.getElementById("client_role");
    const legalRoleSelect = document.getElementById("client_legal_role");
    window.caseClientsManager.add({
      ...selected,
      role: roleSelect.value,
      legal_role: legalRoleSelect.value,
    });

    window.Toast.success(`לקוח קיים נוסף לתיק: ${selected.first_name} ${selected.last_name}`);
    input.value = "";
    suggestions.style.display = "none";
  });

  // סגור הצעות בלחיצה בחוץ
  document.addEventListener("click", (e) => {
    if (!suggestions.contains(e.target) && e.target !== input)
      suggestions.style.display = "none";
  });
}



