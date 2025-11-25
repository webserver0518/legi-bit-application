// static/js/user_components/view_case.js

window.init_view_case = async function () {
  await window.utils.waitForDom();

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

    if (taskInput) taskInput.value = "";
    window.Toast?.success?.("המשימה נוספה בהצלחה!");
  }

  if (addTaskBtn) addTaskBtn.onclick = createTask;

  // ✅ שלב 1: העלאת קבצים מיידית (בלי טבלה/תצוגה)
  if (serial) initInstantCaseFileUploader(serial);

  window.API.getJson(`/get_case?serial=${encodeURIComponent(serial)}&expand=true`)
    .then(payload => {
      if (!payload?.success || !payload?.data?.length) return;

      const item = payload.data[0] ?? {};
      const caseObj = item.cases;

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
    body: { files_serials: next }
  });

  if (!upd?.success) {
    throw new Error(upd?.error || "Failed to attach file to case");
  }
}
