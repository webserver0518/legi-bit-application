/* static/js/user_components/add_case.js */

window.init_add_case = function () {
  initFileUploader();          // Initialize drag & drop + file handling
  initAccordionSections();     // Accordion animation logic
  initCaseFormPreview();       // Form submission & validation
  initFieldAutocomplete();     // Field autocomplete
  initClientsManager();        // ✅ Multi-client management
  initRequiredIndicators();    // ✅ Required fields indicators
  initHebrewBirthDatePicker(); // ✅ Birth date input display handling
};

/* Parse API responses safely into a unified object */
const parseApiResponse = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return { data: null, error: 'Invalid server response', success: false, message: '' };
  }
  const hasData = Object.prototype.hasOwnProperty.call(payload, 'data');
  return {
    data: hasData ? payload.data : payload,
    error: payload.error,
    success: payload.success,
    message: payload.message,
  };
};

/* ==============================
   🧩 MULTI-CLIENT MANAGEMENT
   ============================== */
function initClientsManager() {
  const addBtn = document.getElementById("add-client-btn");
  const roleSelect = document.getElementById("client_role");
  const tableBody = document.querySelector("#clients-table tbody");
  const form = document.getElementById("addCaseForm");

  if (!addBtn || !tableBody) return;

  window.clientsList = [];

  // ➕ Add client button
  addBtn.addEventListener("click", () => {
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

    clientsList.push(client);
    renderClientsTable();
    clearClientFields();
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

  // 🧾 Render client list in the table
  function renderClientsTable() {
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

    // ✅ Require at least one main client before submission
    const hasMain = (window.clientsList || []).some(c => c.role === "main");
    if (!hasMain) {
      alert("יש להוסיף לפחות לקוח ראשי אחד לפני פתיחת תיק");
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
      alert("יש למלא כותרת לתיק");
      return;
    }

    const form_data = {
      created_at: timestamp,
      title: fd.get('title'),
      field: fd.get('field'),
      facts: fd.get('facts'),
      against: fd.get('against'),
      against_type: document.getElementById('against-type')?.value || '',
      clients: window.clientsList || [], // ✅ include all clients
    };

    try {
      const res = await fetch("/create_new_case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form_data)
      });

      const json = await res.json();
      const parsed = parseApiResponse(json);
      if (!parsed.success) {
        showToast(`❌ Failed to create case: ${parsed.error}`, true);
        return;
      }
      showToast("✅ Case created successfully");
      localStorage.setItem("selectedSubMenu", "all_cases");
      showSubMenu("all_cases");
      loadContent("cases", true, "user");
    } catch (error) {
      console.error(error);
      showToast("⚠️ Error contacting server", true);
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
    onReady(_, __, fp) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "btn btn-outline-secondary btn-sm ms-2";
      clearBtn.textContent = "נקה";
      clearBtn.onclick = () => fp.clear();
      fp.calendarContainer.appendChild(clearBtn);
    }
  });
}
