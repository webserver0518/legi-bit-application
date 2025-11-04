/* static/js/user_components/add_case.js */

window.init_add_case = function () {
  initFileUploader();          // Initialize drag & drop + file handling
  initAccordionSections();     // Accordion animation logic
  initCaseFormPreview();       // Form submission & validation
  initCategoryAutocomplete();  // Category autocomplete
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

/* File uploader (drag & drop + manual selection) */
(() => {

  window.initFileUploader = function () {
    const dropArea = document.getElementById('drop-area');
    if (!dropArea || dropArea.dataset.ready) return;
    dropArea.dataset.ready = "1";

    const pickInput = document.getElementById('fileElem');
    const tbody = document.querySelector('#fileTable tbody');
    const form = document.getElementById('addCaseForm');

    // Ensure a hidden real file input exists
    let realInput = document.getElementById('realFileInput');
    if (!realInput) {
      realInput = document.createElement('input');
      realInput.type = 'file';
      realInput.name = 'files[]';
      realInput.id = 'realFileInput';
      realInput.hidden = true;
      realInput.multiple = true;
      form.appendChild(realInput);
    }

    const dt = new DataTransfer(); // Virtual clipboard to track files
    const nameCount = {};          // Prevent duplicate filenames

    const stop = e => { e.preventDefault(); e.stopPropagation(); };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
      dropArea.addEventListener(ev, stop, false)
    );

    // Events for drag/drop and manual file selection
    dropArea.addEventListener('click', () => pickInput.click());
    dropArea.addEventListener('dragover', () => dropArea.classList.add('highlight'));
    dropArea.addEventListener('dragleave', () => dropArea.classList.remove('highlight'));
    dropArea.addEventListener('drop', e => {
      dropArea.classList.remove('highlight');
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    });

    pickInput.addEventListener('change', () => addFiles(pickInput.files));

    /* Add files to the table and virtual clipboard */
    function addFiles(list) {
      [...list].forEach(f => {
        dt.items.add(f);
        addRow(f);
      });
      realInput.files = dt.files;
      pickInput.value = '';
    }

    /* Generate unique filenames if duplicates are found */
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

    /* Add new file row to the table */
    async function addRow(file) {
      const disp = unique(file.name);
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${disp}</td>
        <td>
          <select class="form-select form-select-sm" name="file_type_${disp}">
            <option>טוען...</option>
          </select>
        </td>
        <td class="text-center">
          <button type="button" class="btn btn-sm btn-outline-danger">✖</button>
        </td>
      `;
      tbody.appendChild(tr);

      // Load document type list from backend JSON
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
      } catch (err) {
        console.error("❌ שגיאה בטעינת סוגי המסמכים:", err);
      }

      // Delete row + file
      tr.querySelector('button').onclick = () => {
        const idx = [...tbody.children].indexOf(tr);
        dt.items.remove(idx);
        tr.remove();
        realInput.files = dt.files;
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

      // Close any open accordion section
      document.querySelectorAll(".accordion-collapse.show").forEach(openItem => {
        if (openItem !== content) {
          openItem.style.height = `${openItem.scrollHeight}px`;
          requestAnimationFrame(() => {
            openItem.style.height = "0";
          });
          openItem.classList.remove("show");
        }
      });

      // Toggle current section
      if (isOpen) {
        content.style.height = `${content.scrollHeight}px`;
        requestAnimationFrame(() => {
          content.style.height = "0";
        });
        content.classList.remove("show");
      } else {
        content.classList.add("show");
        content.style.height = "0";
        requestAnimationFrame(() => {
          content.style.height = `${content.scrollHeight}px`;
        });
        content.addEventListener("transitionend", () => {
          if (content.classList.contains("show")) {
            content.style.height = "auto";
          }
        }, { once: true });
      }
    });
  });
};

/* Main form submission: create case + upload files */
window.initCaseFormPreview = function () {
  const form = document.getElementById("addCaseForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(form);

    // Append timestamp with timezone offset
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

    // Step 1: Create case record and get its serial
    const form_data = {
      created_at: timestamp,
      title: fd.get('title'),
      category: fd.get('category'),
      facts: fd.get('facts'),
      client_first_name: fd.get('client_first_name'),
      client_last_name: fd.get('client_last_name'),
      client_phone: fd.get('client_phone'),
      client_email: fd.get('client_email'),
      client_city: fd.get('client_city'),
      client_street: fd.get('client_street'),
      client_street_number: fd.get('client_street_number'),
      client_postal_code: fd.get('client_postal_code'),
      client_id_card_number: fd.get('client_id_card_number'),
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

        // ✅ UI reload
        localStorage.setItem("selectedSubMenu", "all_cases");
        showSubMenu("all_cases");
        loadContent("active_cases", true, "user");

      } catch (error) {
        console.error(error);
        showToast("⚠️ Error contacting server", true);
      }

  /*
    const initJson = await initRes.json().catch(() => null);
    const initParsed = parseApiResponse(initJson);
    const { serial, office_name } = initParsed.data || {};

    // Step 2: Upload files to S3 using presigned URLs
    const uploadedNames = [];
    for (const f of files) {
      const presRes = await fetch("/s3/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: f.name,
          filetype: f.type,
          filesize: f.size,
          serial: serial
        })
      });

      const { presigned, safe_name, error } = await presRes.json();
      if (!presRes.ok || error) {
        showToast(`❌ Failed to generate presigned URL for ${f.name}`, true);
        return;
      }

      const s3Form = new FormData();
      Object.entries(presigned.fields).forEach(([k, v]) => s3Form.append(k, v));
      s3Form.append("file", f);

      const s3Upload = await fetch(presigned.url, { method: "POST", body: s3Form });
      if (!s3Upload.ok) {
        showToast(`❌ Failed to upload ${f.name} to S3`, true);
        return;
      }

      uploadedNames.push(safe_name);
    }

    // Replace blobs with uploaded file names
    fd.delete("files[]");
    uploadedNames.forEach(n => fd.append("uploaded[]", n));

    fd.append("serial", serial);

    // Step 3: Send full case form to backend
    try {
      const response = await fetch("/create_case", {
        method: "POST",
        body: fd
      });

      if (response.ok) {
        showToast("Case created successfully");

        localStorage.setItem("selectedSubMenu", "all_cases");
        localStorage.setItem("activeSubMenuText", "תיקים פעילים");
        localStorage.setItem("activeMainMenuText", "כל התיקים");

        showSubMenu("all_cases");
        loadContent(page = "active_cases", force = true, type = 'client');

        const subLinks = document.querySelectorAll('.sub-sidebar a');
        subLinks.forEach(link => {
          if (link.textContent.trim() === "תיקים פעילים") {
            highlightInSidebar(link, 'sub-sidebar');
          }
        });

        const mainLinks = document.querySelectorAll('.sidebar a');
        mainLinks.forEach(link => {
          if (link.textContent.trim() === "כל התיקים") {
            highlightInSidebar(link, 'sidebar');
          }
        });
      } else {
        showToast("❌ Form submission failed", true);
      }
    }

  */

  });
};

/* Autocomplete for case category selection */
window.initCategoryAutocomplete = async function () {
  const input = document.getElementById("category-input");
  const suggestions = document.getElementById("category-suggestions");
  if (!input) return;

  try {
    const res = await fetch("/get_case_categories");
    const categories = await res.json();

    // Show dropdown suggestions based on input text
    function showSuggestions(filter = "") {
      const value = filter.trim();
      suggestions.innerHTML = "";
      const matches = categories.filter(cat =>
        cat.label.includes(value)
      );

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
      if (!suggestions.contains(e.target) && e.target !== input) {
        suggestions.innerHTML = "";
      }
    });
  } catch (err) {
    console.error("Failed to load categories:", err);
  }
};
