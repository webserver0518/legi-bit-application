// static/js/user_components/view_case.js

window.init_view_case = async function () {
  await window.utils.waitForDom();

  const activityBox = document.getElementById("case-activity-list");
  if (activityBox) lockScrollInside(activityBox);

  const queue = (window.Recents?.get('case') || []);
  const serial = queue[0];

  const taskInput = document.getElementById("task-description");
  const addTaskBtn = document.getElementById("add-task");

  async function createTask() {
    const description = (taskInput?.value || "").trim();
    if (!serial) return window.Toast?.warning?.("לא נמצא מספר תיק.");
    if (!description) return window.Toast?.warning?.("נא להזין תיאור משימה.");

    if (addTaskBtn) addTaskBtn.disabled = true;

    const payload = {
      case_serial: serial,
      description,
      created_at: window.utils.buildLocalTimestamp(),
    };

    const res = await window.API.postJson("/create_new_task", payload);

    if (addTaskBtn) addTaskBtn.disabled = false;

    if (!res?.success) {
      const msg = res.message || res.error || "יצירת משימה נכשלה.";
      return window.Toast?.warning?.(msg);
    }

    const newTaskSerial = res.data;

    const upd = await window.API.apiRequest(`/update_case?serial=${serial}`, {
      method: "PATCH",
      body: {
        _operator: "$addToSet",
        tasks_serials: newTaskSerial
      }
    });
    if (!upd?.success) {
      return window.Toast?.warning?.(upd?.error || "עדכון התיק נכשל");
    }

    if (taskInput) taskInput.value = "";
    window.Toast?.success?.("המשימה נוספה בהצלחה!");

    try { await reloadCaseActivityMinimal(serial); } catch { }
  }

  if (addTaskBtn) addTaskBtn.onclick = createTask;

  // ✅ שלב 1: העלאת קבצים מיידית (בלי טבלה/תצוגה)
  if (serial) initInstantCaseFileUploader(serial);
  if (serial) { try { await reloadCaseActivityMinimal(serial); } catch { } }

  window.API.getJson(`/get_case?serial=${encodeURIComponent(serial)}&expand=true`)
    .then(payload => {
      if (!payload?.success || !payload?.data?.length) return;

      const item = payload.data[0] ?? {};
      const caseObj = item.cases;

      console.log("Loaded case:", caseObj);

      const user = caseObj.user;
      const clients = caseObj.clients;

      const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = window.utils.safeValue(val);
      };

      setText("case-title", caseObj.title);
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
          : clients.map(c => `
              <tr>
                <td>${window.utils.safeValue(c.first_name)}</td>
                <td>${window.utils.safeValue(c.last_name)}</td>
                <td>${window.utils.safeValue(c.legal_role)}</td>
                <td>${window.utils.safeValue(c.id_card_number)}</td>
                <td>${window.utils.safeValue(c.phone)}</td>
                <td>${window.utils.safeValue(c.email)}</td>
                <td>${window.utils.safeValue(c.role)}</td>
              </tr>
            `).join("");
      }
    });
};

function getFileIconHTML(filename) {
  const name = (filename || "").toLowerCase();

  const byExt = (exts, icon) => exts.some(ex => name.endsWith("." + ex)) && icon;

  const icon =
    byExt(["pdf"], "PDF") ||
    byExt(["doc", "docx", "rtf"], "WORD") ||
    byExt(["xls", "xlsx", "csv"], "EXCEL") ||
    byExt(["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "svg"], "IMAGE") ||
    byExt(["mp4", "mov", "avi", "mkv", "webm", "m4v"], "VIDEO") ||
    byExt(["mp3", "m4a", "wav", "ogg", "flac"], "AUDIO") ||
    byExt(["zip", "rar", "7z", "tar", "gz", "bz2"], "ARCHIVE") ||
    "GENERIC";

  const src = `/static/images/icons/${icon}.svg`;
  // סגנון קטן inline כדי לא לגעת ב-CSS
  return `<img src="${src}" alt="" style="width:18px;height:18px;vertical-align:-3px;margin-inline-end:6px;">`;
}

// === Minimal Activity List (TYPE, CREATEDAT, META) ===

function formatDateTimeShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildActivityModelFromCase(caseObj) {
  const files = Array.isArray(caseObj?.files) ? caseObj.files : [];
  const tasks = Array.isArray(caseObj?.tasks) ? caseObj.tasks : [];

  const fileItems = files.map(f => ({
    TYPE: "file",
    CREATEDAT: f.created_at || f.uploaded_at || null,
    META: {
      serial: f.serial,
      name: f.name || "ללא שם",
      description: f.description || "",
      size: f.size,
      uploaded_by: f.uploaded_by,
    }
  }));

  const taskItems = tasks.map(t => ({
    TYPE: "task",
    CREATEDAT: t.created_at || null,
    META: {
      serial: t.serial,
      description: t.description || "משימה",
      status: t.status || "open",
      created_by: t.created_by,
    }
  }));

  const toTs = v => (v ? new Date(v).getTime() : -Infinity);
  return [...fileItems, ...taskItems].sort((a, b) => toTs(b.CREATEDAT) - toTs(a.CREATEDAT)); // חדש למעלה
}

function renderActivityRow(item) {
  const isFile = item.TYPE === "file";
  const icon = isFile ? "📄" : "✏️";
  const middleText = isFile
    ? (item.META?.name || "קובץ")
    : (item.META?.description || "משימה");
  const when = formatDateTimeShort(item.CREATEDAT);
  const attrs = isFile
    ? ` class="activity-file-link text-decoration-none" data-file-serial="${String(item.META?.serial || "")}" data-file-name="${String(item.META?.name || "")}"`
    : "";

  if (isFile) {
    const fileName = item.META?.name || "קובץ";
    const fileDesc = item.META?.description || ""; // תיאור להצגה בלבד
    const fileEmoji = getFileIconHTML(fileName);

    return `
      <div class="event-row file d-flex justify-content-between align-items-center p-3 rounded bg-orange-light">
        <div class="event-icon fs-5" title="קובץ">${fileEmoji}</div>
        <div class="event-details text-center flex-grow-1">
          <div class="fw-semibold text-start">
            <a${attrs}>${window.utils.safeValue(fileName)}</a>
            - ${window.utils.safeValue(fileDesc)}
          </div>
        </div>
        <div class="event-time text-muted small">${when}</div>
      </div>
    `;
  } else {
    const taskText = item.META?.description || "משימה";
    return `
      <div class="event-row task d-flex justify-content-between align-items-center p-3 rounded bg-orange-light">
        <div class="event-icon fs-5" title="משימה">✏️</div>
        <div class="event-details text-start flex-grow-1" dir="rtl">
          <div>${window.utils?.safeValue ? window.utils.safeValue(taskText) : taskText}</div>
        </div>
        <div class="d-flex align-items-center gap-2">

          <!-- 🔔 אייקון הפעמון -->
         <img src="/static/images/icons/BELL.svg" style="width:16px;height:16px;cursor:pointer;">

          <!-- התאריך -->
          <div class="event-time text-muted small">${when}</div>

        </div>
      </div>
    `;
  }
}

async function reloadCaseActivityMinimal(caseSerial) {
  const host = document.getElementById("case-activity-list");
  if (!host) return;

  host.innerHTML = `<div class="text-center text-muted py-3">טוען פעילות…</div>`;

  const payload = await window.API.getJson(`/get_case?serial=${encodeURIComponent(caseSerial)}&expand=true`);
  if (!payload?.success || !payload?.data?.length) {
    host.innerHTML = `<div class="text-center text-danger py-3">${payload?.error || "שגיאה בטעינת פעילות"}</div>`;
    return;
  }

  const caseObj = (payload.data[0] || {}).cases || {};
  const items = buildActivityModelFromCase(caseObj);

  if (!items.length) {
    host.innerHTML = `<div class="text-center text-muted py-3">אין פעילות עדיין</div>`;
    return;
  }

  host.innerHTML = items.map(renderActivityRow).join("");

  // פתיחת קובץ בלחיצה – שולחים את שלושת הפרמטרים שה-API דורש
  host.onclick = async (ev) => {
    const a = ev.target.closest(".activity-file-link");
    if (!a) return;
    ev.preventDefault();
    const fileSerial = a.getAttribute("data-file-serial");
    const fileName = a.getAttribute("data-file-name");
    if (!fileSerial || !fileName) {
      return window.Toast?.danger?.("חסר מידע על הקובץ (serial/name)");
    }
    const url = `/get_file_url?case_serial=${encodeURIComponent(caseSerial)}&file_serial=${encodeURIComponent(fileSerial)}&file_name=${encodeURIComponent(fileName)}`;
    const res = await window.API.getJson(url);
    console.log("Get file URL response:", res);
    if (res?.success && res?.data) {
      window.open(res.data, "_blank");
    } else {
      window.Toast?.danger?.(res?.error || "שגיאה בפתיחת הקובץ");
    }
  };
}


function initInstantCaseFileUploader(case_serial) {
  const dropArea = document.getElementById("drop-area");
  const pickInput = document.getElementById("fileElem");
  if (!dropArea || !pickInput) return;

  // prevent duplicate listeners on reloads
  if (dropArea.dataset.uploadReady) return;
  dropArea.dataset.uploadReady = "1";

  // we do NOT use the table at all (it stays d-none in HTML)
  let uploadChain = Promise.resolve();
  let officeSerialPromise = null;

  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };

  ["dragenter", "dragover", "dragleave", "drop"].forEach(ev => {
    dropArea.addEventListener(ev, stop, false);
  });

  dropArea.addEventListener("click", () => pickInput.click());
  dropArea.addEventListener("dragover", () => dropArea.classList.add("highlight"));
  dropArea.addEventListener("dragleave", () => dropArea.classList.remove("highlight"));

  dropArea.addEventListener("drop", (e) => {
    dropArea.classList.remove("highlight");
    const files = e.dataTransfer?.files;
    if (files?.length) enqueueFiles(files);
  });

  pickInput.addEventListener("change", () => {
    const files = pickInput.files;
    if (files?.length) enqueueFiles(files);
    pickInput.value = ""; // allow re-select same file
  });

  function enqueueFiles(fileList) {
    [...fileList].forEach(file => {
      uploadChain = uploadChain
        .then(() => uploadSingleFileFlow(file))
        .catch(err => {
          // keep chain alive for next files
          console.error("Upload chain error:", err);
        });
    });
  }

  async function getOfficeSerial() {
    if (!officeSerialPromise) {
      officeSerialPromise = window.API.getJson("/get_office_serial")
        .then(res => {
          const officeSerial = res?.data?.office_serial;
          if (!res?.success || !officeSerial) throw new Error("Office serial not found");
          return officeSerial;
        });
    }
    return officeSerialPromise;
  }

  async function uploadSingleFileFlow(file) {
    if (!file || !file.name) return;

    const office_serial = await getOfficeSerial();
    const timestamp = window.utils.buildLocalTimestamp();
    const caseSerialNum = Number(case_serial);

    window.Toast?.info?.(`מעלה "${file.name}"...`);

    let file_serial = null;

    try {
      // 1) create file record
      const created = await window.API.postJson("/create_new_file", {
        created_at: timestamp,
        case_serial: isNaN(caseSerialNum) ? case_serial : caseSerialNum,
        client_serial: "",
        name: file.name,
        technical_type: file.type || null,
        content_type: null,
        description: "",
      });

      if (!created?.success || !created?.data) {
        throw new Error(created?.error || "Failed to create file record");
      }

      file_serial = created.data;

      // 2) presign post
      const uploadKey = `uploads/${office_serial}/${case_serial}/${file_serial}/${file.name}`;

      const presign = await window.API.postJson("/presign/post", {
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        file_size: file.size,
        key: uploadKey
      });

      const presigned = presign?.data?.presigned;
      if (!presign?.success || !presigned?.url || !presigned?.fields) {
        throw new Error(presign?.error || "Failed to get presigned POST");
      }

      // 3) upload to S3/minio
      await uploadViaPresignedPost(presigned, file);

      // 4) mark file available
      await window.API.apiRequest(`/update_file?serial=${Number(file_serial)}`, {
        method: "PATCH",
        body: { status: "available" }
      });

      // 5) attach to case (fetch latest -> set full array)
      await appendFileSerialToCase(case_serial, file_serial);

      window.Toast?.success?.(`הקובץ "${file.name}" הועלה בהצלחה`);
      try { await reloadCaseActivityMinimal(case_serial); } catch (e) { console.error(e); }

    } catch (err) {
      console.error("Upload failed:", file.name, err);
      window.Toast?.danger?.(`העלאת "${file.name}" נכשלה`);

      // cleanup mongo record (same approach as new_case)
      if (file_serial) {
        try {
          await window.API.apiRequest(`/delete_file?serial=${Number(file_serial)}`, { method: "DELETE" });
        } catch (cleanupErr) {
          console.error("Failed to cleanup failed file record:", cleanupErr);
        }
      }
    }
  }
}

function uploadViaPresignedPost(presigned, file) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    Object.entries(presigned.fields || {}).forEach(([k, v]) => formData.append(k, v));
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", presigned.url, true);

    xhr.onload = () => {
      // AWS S3 often returns 204; some providers may return 201/200
      if ([200, 201, 204].includes(xhr.status)) return resolve();
      reject(new Error(`Upload failed with status ${xhr.status}`));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}

async function appendFileSerialToCase(case_serial, file_serial) {
  const payload = await window.API.getJson(`/get_case?serial=${encodeURIComponent(case_serial)}&expand=false`);
  if (!payload?.success || !payload?.data?.length) {
    throw new Error("Failed to load case for updating files_serials");
  }

  const item = payload.data[0] ?? {};
  const caseObj = item.cases || {};
  const current = Array.isArray(caseObj.files_serials) ? caseObj.files_serials : [];

  const next = Array.from(new Set([
    ...current.map(n => Number(n)).filter(Number.isFinite),
    Number(file_serial)
  ]));

  const upd = await window.API.apiRequest(`/update_case?serial=${encodeURIComponent(case_serial)}`, {
    method: "PATCH",
    body: {
      _operator: "$addToSet",
      files_serials: Number(file_serial)
    }
  });

  if (!upd?.success) {
    throw new Error(upd?.error || "Failed to attach file to case");
  }
}

function lockScrollInside(el) {
  el.addEventListener("wheel", function (e) {
    const delta = e.deltaY;
    const atTop = el.scrollTop === 0;
    const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop <= 1;

    // גלילה למעלה בראש הרשימה
    if (delta < 0 && atTop) {
      e.preventDefault();
      return;
    }
    // גלילה למטה בתחתית הרשימה
    if (delta > 0 && atBottom) {
      e.preventDefault();
      return;
    }
  }, { passive: false });
}