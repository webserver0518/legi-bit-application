/* static/js/user_components/add_case.js */

window.init_add_case = function () {
  initFileUploader();          // Initialize drag & drop + file handling
  initAccordionSections();     // Accordion animation logic
  initCaseFormPreview();       // Form submission & validation
  initFieldAutocomplete();     // Field autocomplete
  initClientsManager();        // ✅ Multi-client management
  initRequiredIndicators();    // ✅ Required fields indicators
  initHebrewBirthDatePicker(); // ✅ Birth date input display handling
  initClientAutocomplete();
};

/* Parse API responses safely into a unified object */
window.parseApiResponse = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return { data: null, error: 'Invalid server response', success: false, message: '' };
  }
  return {
    data: payload?.data ?? null,
    error: payload.error,
    success: payload.success,
    message: payload.message,
  };
};

/* ==============================
   🧩 MULTI-CLIENT MANAGEMENT
   ============================== */

// 🧾 Render client list in the table
window.renderClientsTable = function () {
  const table = document.getElementById("clients-table");
  const tableBody = table.querySelector("tbody");

  if (clientsList.length === 0) {
    table.style.display = "none"; // או table.classList.add('d-none');
    tableBody.innerHTML = "";
    return;
  }

  // אם יש לקוחות — נציג את הטבלה
  table.style.display = "table"; // או table.classList.remove('d-none');
  tableBody.innerHTML = clientsList.map((c, i) => `
      <tr>
        <td>${c.first_name}</td>
        <td>${c.last_name}</td>
        <td>${c.id_card_number || "-"}</td>
        <td>${c.phone || "-"}</td>
        <td>${c.city || "-"}</td>
        <td>${c.street || "-"}</td>
        <td>${c.home_number || "-"}</td>
        <td>${c.postal_code || "-"}</td>
        <td>${c.email || "-"}</td>
        <td>${c.birth_date || "-"}</td>
        <td>${c.role === "main" ? "ראשי" : "משני"}</td>
        <td><button class="btn btn-sm btn-outline-danger" onclick="removeClient(${i})">✖</button></td>
      </tr>
    `).join("");

  document.getElementById("clients-json-input").value = JSON.stringify(clientsList);
};

function initClientsManager() {
  const addBtn = document.getElementById("add-client-btn");
  const roleSelect = document.getElementById("client_role");
  const tableBody = document.querySelector("#clients-table tbody");
  const form = document.getElementById("addCaseForm");

  if (!addBtn || !tableBody) return;

  window.clientsList = [];

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
      birth_date: fd.get("client_birth_date"),
      role: roleSelect?.value || "secondary",
    };

    // ✅ Require minimal client details before adding
    if (!client.first_name) {
      alert("יש למלא שם פרטי לפני הוספת לקוח");
      return;
    }

    try {
      // 🧠 שליחה לשרת כדי לשמור לקוח חדש
      const res = await fetch("/create_new_client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(client)
      });
      const json = await res.json();
      if (!json.success) {
        showToast("❌ שגיאה בהוספת לקוח לשרת", true);
        return;
      }

      const client_serial = json.data;
      client.serial = client_serial;
      clientsList.push(client);
      renderClientsTable();
      clearClientFields();
      showToast(`לקוח חדש נוצר ונוסף לתיק (מס' ${client_serial})`);
    } catch (err) {
      console.error("שגיאה בשליחת לקוח:", err);
      showToast("⚠️ בעיה בחיבור לשרת", true);
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



  // ❌ Remove client by index
  window.removeClient = function (i) {
    clientsList.splice(i, 1);
    renderClientsTable();
  };

  renderClientsTable();
}

/* ==============================
   📂 File uploader (drag & drop)
   ============================== */
(() => {
  window.initFileUploader = function () {
    const dropArea = document.getElementById('drop-area');
    if (!dropArea || dropArea.dataset.ready) return;
    dropArea.dataset.ready = "1";

    const pickInput = document.getElementById('fileElem');
    const tbody = document.querySelector('#fileTable tbody');

    // ✅ נשתמש במערך גלובלי במקום input מוסתר
    window.filesList = [];
    const nameCount = {};

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
        <td><select class="form-select form-select-sm" name="file_type_${disp}"><option>טוען...</option></select></td>
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
        type: null,   // יתעדכן לפי הבחירה של המשתמש
        status: "pending",
        key: null,
        row: tr       // נשתמש בזה כדי לעדכן את ה־progress bar
      });

      // טעינת סוגי המסמכים
      try {
        const res = await fetch("/get_document_types");
        const types = await res.json();
        const select = tr.querySelector("select");
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
          if (entry) entry.type = select.value;
        });
      } catch (err) {
        console.error("❌ שגיאה בטעינת סוגי המסמכים:", err);
      }

      tr.querySelector('button').onclick = () => {
        tr.remove();
        window.filesList = window.filesList.filter(f => f.file !== file);
      };
    }
  };
})();






/**
 * 🧠 Upload all files in files to S3 via the Flask /presign/post service
 * Uses presigned URLs and updates progress bars in real time
 */
async function uploadAllFilesToS3(files, office_serial, case_serial) {
  console.log(files.length)
  if (!files || files.length === 0) {
    console.log("⚠️ No files to upload");
    return true;
  }

  // סינון רק קבצים שטרם הועלו או שנכשלו
  const toUpload = files.filter(f => f.status === "pending" || f.status === "failed");
  if (toUpload.length === 0) return true;

  const now = new Date();
  const tzOffset = -now.getTimezoneOffset();
  const sign = tzOffset >= 0 ? "+" : "-";
  const pad = n => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const offsetHours = pad(tzOffset / 60);
  const offsetMinutes = pad(tzOffset % 60);
  const timestamp = now.getFullYear() + "-" +
    pad(now.getMonth() + 1) + "-" +
    pad(now.getDate()) + "T" +
    pad(now.getHours()) + ":" +
    pad(now.getMinutes()) +
    sign + offsetHours + ":" + offsetMinutes;

  for (const fileEntry of toUpload) {
    const { file, row } = fileEntry;
    const progressBar = row.querySelector(".progress-bar");

    try {
      // --- 1️⃣ קבלת כתובת חתומה מהשרת ---
      progressBar.style.width = "10%";
      progressBar.classList.remove("bg-success", "bg-danger");
      progressBar.classList.add("bg-info");
      fileEntry.status = "creating_record";

      const createFileRes = await fetch("/create_new_file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          created_at: timestamp,
          case_serial: case_serial,
          file_name: file.name,
          file_type: file.type
        }),
      });

      const createJson = await createFileRes.json();
      const parsedCreate = parseApiResponse(createJson);
      if (!parsedCreate.success || !parsedCreate.data) {
        throw new Error(parsedCreate.error || "Failed to create file record");
      }

      const file_serial = parsedCreate.data; // ✅ לפי איך שאתה מחזיר מהשרת
      fileEntry.serial = file_serial;

      // 2️⃣ צור key ייחודי הכולל office, case, file
      const key = `uploads/${office_serial}/${case_serial}/${file_serial}-${file.name}`;
      fileEntry.key = key;


      // 3️⃣ בקשת presigned URL ל-S3
      const presignRes = await fetch("/presign/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          key: key
        })
      });

      const presignJson = await presignRes.json();
      const parsed = parseApiResponse(presignJson);
      if (!parsed.success || !parsed.data?.presigned?.url) {
        throw new Error(parsed.error || "Failed to get presigned URL");
      }

      const { url, fields } = parsed.data.presigned;

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
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(formData);
      });

      console.log(`✅ Uploaded ${file.name} to S3 (${key})`);

      await fetch(`/update_file?serial=${Number(fileEntry.serial)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "available"
        })
      });
    } catch (err) {
      console.error("❌ Upload failed for:", file.name, err);
      progressBar.classList.remove("bg-info");
      progressBar.classList.add("bg-danger");
      progressBar.style.width = "100%";
      fileEntry.status = "failed";
    }
  }

  return {
    success: files.every(f => f.status === "done"),
    uploaded: files
      .filter(f => f.status === "done")
      .map(f => ({
        name: f.file.name,
        key: f.key,
        serial: f.serial
      }))
  };
}







/* Accordion open/close animation handler */
window.initAccordionSections = function () {
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

/* Form submission */
window.initCaseFormPreview = function () {
  const form = document.getElementById("addCaseForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // prevent multiple submissions
    const submitBtn = form.querySelector("button[type='submit']");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "יוצר תיק...";
    }

    // ✅ Require at least one main client before submission
    const hasMain = (window.clientsList || []).some(c => c.role === "main");
    if (!hasMain) {
      showToast("יש להוסיף לפחות לקוח ראשי אחד לפני פתיחת תיק", true);
      submitBtn.disabled = false;
      submitBtn.textContent = "פתח תיק";
      return;
    }

    const fd = new FormData(form);
    const now = new Date();
    const tzOffset = -now.getTimezoneOffset();
    const sign = tzOffset >= 0 ? "+" : "-";
    const pad = n => String(Math.floor(Math.abs(n))).padStart(2, "0");
    const offsetHours = pad(tzOffset / 60);
    const offsetMinutes = pad(tzOffset % 60);
    const timestamp = now.getFullYear() + "-" +
      pad(now.getMonth() + 1) + "-" +
      pad(now.getDate()) + "T" +
      pad(now.getHours()) + ":" +
      pad(now.getMinutes()) +
      sign + offsetHours + ":" + offsetMinutes;


    if (!fd.get('title')) {
      showToast("יש למלא כותרת לתיק", true);
      submitBtn.disabled = false;
      submitBtn.textContent = "פתח תיק";
      return;
    }

    const form_data = {
      created_at: timestamp,
      title: fd.get('title'),
      field: fd.get('field'),
      facts: fd.get('facts'),
      against: fd.get('against'),
      against_type: document.getElementById('against-type')?.value || '',
      clients: (window.clientsList || []).map(c => ({
        client_serial: c.serial,
        role: c.role
      }))
    };

    // 🟢 שליחת הנתונים לשרת
    try {
      const res = await fetch("/create_new_case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form_data)
      });

      const json = await res.json();
      const parsed = parseApiResponse(json);
      if (!parsed.success || !parsed.data) {
        showToast(`❌ Failed to create case: ${parsed.error}`, true);
        return;
      }
      showToast("✅ Case created successfully");

      const case_serial = parsed.data;

      // כעת נשלוף את מזהה המשרד
      let office_serial;
      try {
        office_serial = await getOfficeSerial();
      } catch {
        submitBtn.disabled = false;
        submitBtn.textContent = "פתח תיק";
        return; // עצור אם לא הצלחנו לקבל מזהה משרד
      }

      if (!window.filesList || window.filesList.length === 0) {
        showToast("⚠️ לא נבחרו קבצים, התיק ייווצר ללא מסמכים");
        localStorage.setItem("selectedSubMenu", "all_cases");
        showSubMenu("all_cases");
        loadContent("cases", true, "user");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "פתח תיק";
        }
        return;
      }

      /* 2️⃣ העלאת קבצים עם key לפי office+case */
      submitBtn.textContent = "מעלה קבצים...";
      const { success, uploaded } = await uploadAllFilesToS3(window.filesList, office_serial, case_serial);

      if (!success) {
        throw new Error("חלק מהקבצים לא הועלו בהצלחה");
      }

      /* 3️⃣ שמירת רשומות FILES במונגו */
      submitBtn.textContent = "שומר קבצים...";
      const fileSerials = uploaded.map(f => f.serial);

      const updateRes = await fetch(`/update_case?serial=${case_serial}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files_serials: fileSerials
        }),
      });

      const updateJson = await updateRes.json();
      const parsedUpdate = parseApiResponse(updateJson);

      if (!parsedUpdate.success) {
        throw new Error(parsedUpdate.error || "שגיאה בשמירת הקבצים");
      }

      showToast("✅ Case Files Uploaded");


      localStorage.setItem("selectedSubMenu", "all_cases");
      showSubMenu("all_cases");
      loadContent("cases", true, "user");

    } catch (error) {
      console.error(error);
      showToast("⚠️ Error contacting server", true);

    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "פתח תיק";
      }
    }

  });
};

/* Autocomplete for case field selection */
window.initFieldAutocomplete = async function () {
  const input = document.getElementById("field-input");
  const suggestions = document.getElementById("field-suggestions");
  if (!input) return;

  try {
    const res = await fetch("/get_case_categories");
    const categories = await res.json();
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
      instance.calendarContainer.appendChild(clearBtn);
    }
  });
}


async function getOfficeSerial() {
  try {
    const res = await fetch("/get_office_serial");
    const json = await res.json();
    const parsed = parseApiResponse(json);
    if (!parsed.success || !parsed.data?.office_serial) {
      throw new Error("Office serial not found");
    }
    return parsed.data.office_serial;
  } catch (err) {
    console.error("❌ Failed to get office_serial:", err);
    showToast("⚠️ שגיאה בשליפת מזהה משרד", true);
    throw err;
  }
}





async function initClientAutocomplete() {
  const input = document.getElementById("client-first-name-input");
  const suggestions = document.getElementById("client-name-suggestions");
  if (!input || !suggestions) return;

  let officeClients = [];
  try {
    const res = await fetch("/get_office_clients");
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      officeClients = json.data;
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
    const alreadyExists = (window.clientsList || []).some(c => c.serial == selected.serial);
    if (alreadyExists) {
      showToast("⚠️ הלקוח כבר נוסף לרשימה");
      suggestions.style.display = "none";
      input.value = "";
      return;
    }

    // אם אין רשימה גלובלית – צור
    if (!window.clientsList) window.clientsList = [];

    // הוסף לקוח לרשימה
    window.clientsList.push({
      ...selected,
      role: selected.role || "secondary"
    });

    // רענן את הטבלה
    if (typeof renderClientsTable === "function") {
      renderClientsTable();
    }

    showToast(`לקוח קיים נוסף לתיק: ${selected.first_name} ${selected.last_name}`);
    input.value = "";
    suggestions.style.display = "none";
  });

  // סגור הצעות בלחיצה בחוץ
  document.addEventListener("click", (e) => {
    if (!suggestions.contains(e.target) && e.target !== input)
      suggestions.style.display = "none";
  });
}