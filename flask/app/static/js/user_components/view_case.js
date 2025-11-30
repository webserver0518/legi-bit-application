/* view_case.js — LEGIBIT view case (HTML+CSS שכבר מוכנים)
   דרישות: api.js (window.API), utils.js (window.utils), toast.js (window.Toast),
           recentManager.js (window.Recents)
*/
(() => {
  'use strict';

  // ---------- State ----------
  let CASE = null;               // ה־case המלא שחזר מהשרת (expand=true)
  let CASE_SERIAL = null;
  let RECORDS = [];              // איחוד files + tasks לתצוגת "אירועים + מסמכים"
  let SORT = 'desc';             // 'asc' | 'desc'
  let SELECTED = [];             // _ids נבחרים לאיחוד (UI בלבד)
  let USERS = [];                // לבחירת "בטיפול"
  let STATUSES = [];             // לבחירת סטטוס

  // DOM refs
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---------- Utils ----------
  const fmtTime = (ts) => ts || ''; // מגיע כבר בפורמט שלך "YYYY-MM-DD HH:MM:SS"
  const iconByMime = (mime, name = '') => {
    if ((name || '').match(/\.(pdf)$/i)) return '📄';
    if ((name || '').match(/\.(docx?|rtf)$/i)) return '📝';
    if ((name || '').match(/\.(xlsx?|csv)$/i)) return '📊';
    if ((name || '').match(/\.(png|jpe?g|gif|webp|bmp|svg)$/i)) return '🖼️';
    if ((name || '').match(/\.(mp4|mov|avi|mkv|webm)$/i)) return '🎞️';
    if ((name || '').match(/\.(mp3|wav|m4a|flac)$/i)) return '🎧';
    return mime?.startsWith('text/') ? '📄' : '📦';
  };
  const stripExt = (s = '') => s.replace(/\.[^.]+$/, '');
  const cap = (s = '') => (s ? s[0].toUpperCase() + s.slice(1) : '');

  // ---------- Bootstrap ----------
  async function init_view_case() {
    // 1) זהה איזה תיק לפתוח
    const recentCases = window.Recents?.get?.('case') || [];
    CASE_SERIAL = Number(recentCases?.[0] || 0);
    if (!CASE_SERIAL) {
      window.Toast.danger('לא נמצא תיק להצגה (RECENTS ריק)');
      return;
    }

    // 2) טען סטטוסים/משתמשים ברקע (ל־dropdownים)
    await Promise.all([loadStatuses(), loadUsers()]).catch(() => { });

    // 3) טען את התיק
    await loadCase(CASE_SERIAL);

    // 4) חבר מאזינים קבועים
    bindNoteBar();
    bindSorter();
    bindUploaders(); // העלאה מיידית

    // 5) רנדר ראשון
    renderHeader();
    renderParties();
    renderFacts();
    buildRecordsFromCase();
    renderRecords();
  }

  async function loadStatuses() {
    // ניסוי ראשון: פרופילים של המשרד (אם קיים route כזה), אחרת נשתמש בקובץ הסטטי
    try {
      const p1 = await window.API.getJson('/get_office_profiles');
      if (p1?.success && Array.isArray(p1.data)) {
        // חפש פרופיל סטטוסים, או הפק רשימה מכל פרופילי status
        STATUSES = uniqueStrings(
          p1.data.flatMap(pr => Array.isArray(pr?.case_statuses) ? pr.case_statuses : [])
        );
        if (STATUSES.length) return;
      }
    } catch (e) { }
    try {
      const p2 = await window.API.getJson('/get_case_statuses');
      if (p2?.success && Array.isArray(p2.data)) STATUSES = p2.data;
    } catch (e) { }
    if (!STATUSES.length) STATUSES = ['active', 'archived', 'pending', 'on-hold'];
  }
  async function loadUsers() {
    try {
      const res = await window.API.getJson('/get_office_users');
      if (res?.success && Array.isArray(res.data)) USERS = res.data;
    } catch (e) { }
  }
  function uniqueStrings(arr) { return Array.from(new Set((arr || []).filter(Boolean))); }

  async function loadCase(serial) {
    const res = await window.API.getJson(`/get_case?serial=${encodeURIComponent(serial)}&expand=true`);
    if (!res?.success || !Array.isArray(res.data) || !res.data[0]) {
      return window.Toast.danger(res?.error || 'שגיאה בטעינת התיק');
    }
    CASE = res.data[0]; // case מורחב
    console.log('Loaded case:', CASE);
  }

  // ---------- Render: Header ----------
  function renderHeader() {
    // סטטי
    $('#created-date').textContent = fmtTime(CASE.created_at || '');
    $('#created-by').textContent = CASE?.user?.username || CASE?.user_serial || '';
    $('#case-number').textContent = CASE.serial || '';
    console.log('Rendering header for case:', CASE.serial);
    console.log('created_at:', CASE.created_at, 'created_by:', CASE.user, 'case_number:', CASE.serial);

    // כותרת — inline input (Enter לשמירה)
    const title = document.createElement('span');
    title.className = 'editable editable-case';
    title.dataset.field = 'title';
    title.textContent = CASE.title || '—';
    $('#case-title').replaceChildren(title);

    // סטטוס — span קליק שהופך ל-select
    const statusWrap = document.createElement('span');
    statusWrap.className = 'status-edit';
    const dot = document.createElement('span');
    dot.className = 'status-dot';
    dot.textContent = CASE.status || '—';
    applyStatusDot(dot, CASE.status);
    statusWrap.appendChild(dot);
    statusWrap.addEventListener('click', () => openStatusSelect(statusWrap));
    $('#status').replaceChildren(statusWrap);

    // בטיפול — span קליק שהופך ל-select משתמשים
    const handler = document.createElement('span');
    handler.className = 'handler-edit';
    handler.textContent = CASE?.responsible?.username || '—';
    handler.addEventListener('click', () => openHandlerSelect(handler));
    $('#handler').replaceChildren(handler);

    attachCaseEditors();
  }

  function applyStatusDot(el, status) {
    el.classList.remove('status-active', 'status-archived', 'status-pending', 'status-on-hold');
    const cls = `status-${(status || '').toLowerCase()}`;
    el.classList.add(cls);
    el.textContent = status || '—';
  }

  function openStatusSelect(container) {
    if (!STATUSES.length) return;
    if (container.querySelector('select')) return;

    const sel = document.createElement('select');
    STATUSES.forEach(s => {
      const o = document.createElement('option'); o.value = s; o.textContent = s;
      if ((CASE.status || '').toLowerCase() === s.toLowerCase()) o.selected = true;
      sel.appendChild(o);
    });
    const commit = async () => {
      const value = sel.value;
      if (!value || value === CASE.status) return rollback();
      const res = await window.API.patchJson(`/update_case?serial=${CASE.serial}`, { status: value });
      if (!res?.success) { window.Toast.danger(res?.error || 'שגיאה בעדכון סטטוס'); return rollback(); }
      CASE.status = value;
      container.replaceChildren();
      const dot = document.createElement('span');
      dot.className = 'status-dot'; applyStatusDot(dot, value);
      container.appendChild(dot);
      window.Toast.success('סטטוס עודכן');
    };
    const rollback = () => {
      container.replaceChildren();
      const dot = document.createElement('span');
      dot.className = 'status-dot'; applyStatusDot(dot, CASE.status);
      container.appendChild(dot);
    };
    sel.addEventListener('change', commit);
    sel.addEventListener('blur', rollback);
    container.replaceChildren(sel);
    sel.focus();
  }

  function openHandlerSelect(container) {
    if (!USERS.length) return;
    if (container.querySelector('select')) return;
    const sel = document.createElement('select');
    USERS.forEach(u => {
      const o = document.createElement('option'); o.value = String(u.serial);
      o.textContent = u.username || `User ${u.serial}`;
      if (Number(CASE?.responsible?.serial) === Number(u.serial) ||
        Number(CASE?.responsible_serial) === Number(u.serial)) o.selected = true;
      sel.appendChild(o);
    });
    const commit = async () => {
      const value = Number(sel.value);
      const prev = Number(CASE?.responsible_serial);
      if (!value || value === prev) return rollback();
      const res = await window.API.patchJson(`/update_case?serial=${CASE.serial}`, { responsible_serial: value });
      if (!res?.success) { window.Toast.danger(res?.error || 'שגיאה בעדכון מטפל'); return rollback(); }
      CASE.responsible_serial = value;
      const picked = USERS.find(u => Number(u.serial) === value);
      CASE.responsible = picked ? { serial: picked.serial, username: picked.username } : null;
      container.textContent = CASE?.responsible?.username || '—';
      window.Toast.success('מטפל עודכן');
    };
    const rollback = () => { container.textContent = CASE?.responsible?.username || '—'; };
    sel.addEventListener('change', commit);
    sel.addEventListener('blur', rollback);
    container.replaceChildren(sel);
    sel.focus();
  }

  function attachCaseEditors() {
    // כותרת
    attachInlineEditor($('.editable-case'), async (value) => {
      const res = await window.API.patchJson(`/update_case?serial=${CASE.serial}`, { title: value });
      if (!res?.success) throw new Error(res?.error || 'עדכון כותרת נכשל');
      CASE.title = value;
      window.Toast.success('הכותרת עודכנה');
    });
  }

  // ---------- Render: Parties ----------
  function renderParties() {
    // Applicants (clients)
    const tbA = $('#applicant-tbody');
    tbA.innerHTML = '';
    (CASE.clients || []).forEach(cl => {
      const tr = document.createElement('tr');
      tr.dataset.clientSerial = String(cl.serial);

      tr.appendChild(tdEditable('first_name', cl.first_name));
      tr.appendChild(tdEditable('last_name', cl.last_name));
      tr.appendChild(tdEditable('id_card_number', cl.id_card_number));
      // כתובת – מפצלים לשני שדות: עיר + רחוב (אם יש), עדיין באותה תא תצוגה
      const addr = document.createElement('td');
      const citySpan = edSpan('city', cl.city);
      const glue = document.createElement('span'); glue.textContent = ' ';
      const streetSpan = edSpan('street', cl.street || cl.address || '');
      addr.appendChild(citySpan); addr.appendChild(glue); addr.appendChild(streetSpan);
      tr.appendChild(addr);

      tr.appendChild(tdEditable('email', cl.email));
      tr.appendChild(tdEditable('phone', cl.phone || cl.home_number || cl.mobile_number));

      tbA.appendChild(tr);
      // מחברים editors עבור כל הספאנים של הלקוח
      $$('span.editable-client', tr).forEach(sp => {
        attachInlineEditor(sp, async (value) => {
          const cs = tr.dataset.clientSerial;
          const field = sp.dataset.field;
          const body = {}; body[field] = value;
          const res = await window.API.patchJson(`/update_client?serial=${cs}`, body);
          if (!res?.success) throw new Error(res?.error || 'עדכון לקוח נכשל');
          window.Toast.success('פרטי לקוח עודכנו');
        });
      });
    });

    // Respondents (against)
    const tbR = $('#respondents-tbody');
    tbR.innerHTML = '';
    const tr = document.createElement('tr');
    tr.appendChild(tdEditableCase('against', CASE.against || ''));
    tr.appendChild(tdEditableCase('against_type', CASE.against_type || ''));
    tr.appendChild(tdText('—')); // phone
    tr.appendChild(tdText('—')); // email
    tr.appendChild(tdText('—')); // address
    tr.appendChild(tdText('—')); // zip
    tbR.appendChild(tr);

    // חבר editors לשדות case (נגד/סוג)
    $$('#respondents-tbody span.editable-case-field').forEach(sp => {
      attachInlineEditor(sp, async (value) => {
        const body = {}; body[sp.dataset.field] = value;
        const res = await window.API.patchJson(`/update_case?serial=${CASE.serial}`, body);
        if (!res?.success) throw new Error(res?.error || 'עדכון פרטי "נגד" נכשל');
        CASE[sp.dataset.field] = value;
        window.Toast.success('פרטי "נגד" עודכנו');
      });
    });
  }

  function tdEditable(field, val) {
    const td = document.createElement('td');
    td.appendChild(edSpan(field, val));
    return td;
  }
  function tdEditableCase(field, val) {
    const td = document.createElement('td');
    const s = document.createElement('span');
    s.className = 'editable editable-case-field';
    s.dataset.field = field;
    s.textContent = (val ?? '') || '—';
    td.appendChild(s);
    return td;
  }
  function tdText(val) {
    const td = document.createElement('td'); td.textContent = val ?? ''; return td;
  }
  function edSpan(field, text) {
    const s = document.createElement('span');
    s.className = 'editable editable-client';
    s.dataset.field = field;
    s.textContent = (text ?? '') || '—';
    return s;
  }

  // ---------- Facts ----------
  function renderFacts() {
    const holder = $('#facts-body');
    const span = document.createElement('span');
    span.className = 'editable editable-facts';
    span.dataset.multiline = '1';
    span.textContent = CASE.facts || '—';
    holder.replaceChildren(span);

    attachInlineEditor(span, async (value) => {
      const res = await window.API.patchJson(`/update_case?serial=${CASE.serial}`, { facts: value });
      if (!res?.success) throw new Error(res?.error || 'עדכון עובדות נכשל');
      CASE.facts = value;
      window.Toast.success('עובדות עודכנו');
    }, { multiline: true });
  }

  // ---------- Records (files + tasks) ----------
  function buildRecordsFromCase() {
    RECORDS = [];
    const who = (u) => u?.username || (typeof u === 'string' ? u : '');
    // tasks
    (CASE.tasks || []).forEach(t => {
      RECORDS.push({
        _id: `t-${t.serial}`,
        kind: 'task',
        serial: t.serial,
        created_at: t.created_at || '',
        user_name: who(t.user) || who(CASE?.user),
        case_serial: CASE.serial,
        name: null,
        technical_type: 'text/note',
        description: t.description || '',
        reminder: t.reminder ?? false,
      });
    });
    // files
    (CASE.files || []).forEach(f => {
      RECORDS.push({
        _id: `f-${f.serial}`,
        kind: 'file',
        serial: f.serial,
        created_at: f.created_at || '',
        user_name: who(f.user) || who(CASE?.user),
        case_serial: CASE.serial,
        name: f.name || '',
        technical_type: f.technical_type || '',
        description: f.description || '',
        file_name: f.name || '',
      });
    });

    // מיון לפי תאריך
    RECORDS.sort((a, b) => {
      const ta = (a.created_at || ''), tb = (b.created_at || '');
      return SORT === 'desc' ? (tb.localeCompare(ta)) : (ta.localeCompare(tb));
    });
  }

  function bindSorter() {
    const btn = $('#sortBtn'), arrow = $('#sortArrow');
    if (!btn) return;
    btn.addEventListener('click', () => {
      SORT = (SORT === 'desc' ? 'asc' : 'desc');
      buildRecordsFromCase();
      renderRecords();
      arrow.textContent = SORT === 'desc' ? '▼' : '▲';
    });
  }

  function renderRecords() {
    const listEl = $('#list');
    const chipsEl = $('#chips');
    const mergeBar = $('#merge-bar');
    const mergeBtn = $('#mergeBtn');
    listEl.innerHTML = '';

    RECORDS.forEach((rec, idx) => {
      rec.__i = idx;

      const item = document.createElement('div');
      item.className = 'item';
      item.dataset.id = rec._id;

      // Row 1: icon + name/desc | time + (bell for notes) + select button
      const line1 = document.createElement('div');
      line1.className = 'line';

      const right1 = document.createElement('div');
      right1.className = 'right';

      // item badge/index + icon + name
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = rec.kind === 'task' ? '🗒️' : iconByMime(rec.technical_type, rec.name);

      const titleSpan = document.createElement('span');
      titleSpan.className = 'title';
      titleSpan.textContent = rec.kind === 'task' ? (stripExt(rec.description).slice(0, 40) || 'הערה') : (rec.name || 'קובץ');

      right1.appendChild(icon);
      right1.appendChild(titleSpan);

      const left1 = document.createElement('div');
      left1.className = 'left';

      // time + bell (for notes) + select
      const timeWrap = document.createElement('span');
      timeWrap.className = 'time-wrap';
      const timeSpan = document.createElement('span');
      timeSpan.className = 'time';
      timeSpan.textContent = fmtTime(rec.created_at);
      timeWrap.appendChild(timeSpan);

      if (rec.kind === 'task') {
        const bell = document.createElement('button');
        bell.className = 'bell-btn' + (rec.reminder ? ' active' : '');
        bell.title = 'תזכורת';
        bell.textContent = '🔔';
        bell.addEventListener('click', (e) => {
          e.stopPropagation();
          openReminderPopup(rec, bell);
        });
        timeWrap.appendChild(bell);
      }

      const selectBtn = document.createElement('button');
      selectBtn.className = 'sel-btn';
      selectBtn.title = 'בחר/בטל לבחירה';
      selectBtn.textContent = selectedIndexBadge(rec._id) || '◻';
      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSelect(rec._id);
      });

      left1.appendChild(timeWrap);
      left1.appendChild(selectBtn);

      line1.appendChild(right1);
      line1.appendChild(left1);
      item.appendChild(line1);

      // Row 2: (file description inline-edit or empty) | uploader
      const line2 = document.createElement('div');
      line2.className = 'line';

      const right2 = document.createElement('div');
      right2.className = 'right';

      if (rec.kind === 'file') {
        const d = document.createElement('span');
        d.className = 'editable file-desc';
        d.dataset.kind = 'file';
        d.dataset.fileSerial = String(rec.serial);
        d.textContent = rec.description || '—';
        right2.appendChild(d);

        // עריכת תיאור קובץ
        attachInlineEditor(d, async (value) => {
          const body = { file_serial: rec.serial, description: value };
          const res = await window.API.postJson('/update_file_description', body);
          if (!res?.success) throw new Error(res?.error || 'עדכון תיאור קובץ נכשל');
          rec.description = value;
          window.Toast.success('תיאור הקובץ עודכן');
        });
      } else {
        right2.appendChild(document.createElement('span'));
      }

      const left2 = document.createElement('div');
      left2.className = 'left';
      const upl = document.createElement('span');
      upl.className = 'uploader';
      upl.textContent = `מעלה: ${rec.user_name || ''}`;
      left2.appendChild(upl);

      line2.appendChild(right2);
      line2.appendChild(left2);
      item.appendChild(line2);

      // Actions (open/delete) — על כל ה-item
      item.addEventListener('click', () => {
        if (rec.kind === 'file') {
          openFile(rec).catch(err => window.Toast.danger(err?.message || 'שגיאה בפתיחת קובץ'));
        }
      });

      // לחצן מחיקה (בפינה)
      const del = document.createElement('button');
      del.className = 'del-btn';
      del.title = rec.kind === 'task' ? 'מחק הערה' : 'מחק קובץ';
      del.textContent = '🗑';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDelete(rec);
      });
      item.appendChild(del);

      listEl.appendChild(item);
    });

    // עדכון merge bar
    const chipsEl2 = $('#chips');
    const mergeBar2 = $('#merge-bar');
    const mergeBtn2 = $('#mergeBtn');

    chipsEl2.innerHTML = '';
    SELECTED.forEach((id, i) => {
      const rec = RECORDS.find(r => r._id === id);
      const chip = document.createElement('span'); chip.className = 'chip';
      chip.innerHTML = `<strong>${i + 1}</strong> ${stripExt(rec?.name || rec?.description || '')}
                        <span class="x" title="הסר">×</span>`;
      chip.querySelector('.x').onclick = () => { toggleSelect(id); };
      chipsEl2.appendChild(chip);
    });
    if (SELECTED.length >= 2) {
      mergeBar2.style.display = 'block';
      mergeBtn2.disabled = false;
      mergeBtn2.textContent = `איחוד מסמכים (${SELECTED.length})`;
    } else if (SELECTED.length === 1) {
      mergeBar2.style.display = 'block';
      mergeBtn2.disabled = true;
      mergeBtn2.textContent = `איחוד מסמכים (1)`;
    } else {
      mergeBar2.style.display = 'none';
    }
  }

  function selectedIndexBadge(id) {
    const idx = SELECTED.indexOf(id);
    return idx >= 0 ? String(idx + 1) : '';
  }
  function toggleSelect(id) {
    const i = SELECTED.indexOf(id);
    if (i >= 0) SELECTED.splice(i, 1);
    else SELECTED.push(id);
    renderRecords();
  }

  async function openFile(rec) {
    const fileSerial = rec.serial;
    const fileName = rec.file_name || rec.name;
    const url = `/get_file_url?case_serial=${encodeURIComponent(CASE.serial)}&file_serial=${encodeURIComponent(fileSerial)}&file_name=${encodeURIComponent(fileName)}`;
    const res = await window.API.getJson(url);
    if (!res?.success || !res.data) throw new Error(res?.error || 'לא ניתן לפתוח את הקובץ');
    window.open(res.data, '_blank');
  }

  function confirmDelete(rec) {
    // אפשר לבנות פופ-אפ משלך ב-#confirm-pop; כרגע פשוט window.confirm
    const isTask = rec.kind === 'task';
    const msg = isTask ? 'למחוק הערה?' : 'למחוק קובץ?';
    if (!window.confirm(msg)) return;

    if (isTask) {
      deleteTask(rec).catch(err => window.Toast.danger(err?.message || 'מחיקת המשימה נכשלה'));
    } else {
      deleteFile(rec).catch(err => window.Toast.danger(err?.message || 'מחיקת הקובץ נכשלה'));
    }
  }

  async function deleteTask(rec) {
    // מעביר גם case_serial כדי שהשרת יוכל לבצע $pull מהתיק (tasks_serials)
    const url = `/delete_task?serial=${encodeURIComponent(rec.serial)}&case_serial=${encodeURIComponent(CASE.serial)}`;
    const res = await window.API.delete(url);
    if (!res?.success) throw new Error(res?.error || 'מחיקת משימה נכשלה');
    // עדכון לוקאלי:
    CASE.tasks = (CASE.tasks || []).filter(t => Number(t.serial) !== Number(rec.serial));
    buildRecordsFromCase();
    renderRecords();
    window.Toast.success('המשימה נמחקה');
  }

  async function deleteFile(rec) {
    const url = `/delete_file?case_serial=${encodeURIComponent(CASE.serial)}&file_serial=${encodeURIComponent(rec.serial)}&file_name=${encodeURIComponent(rec.file_name || rec.name || '')}`;
    const res = await window.API.delete(url);
    if (!res?.success) throw new Error(res?.error || 'מחיקת קובץ נכשלה');
    CASE.files = (CASE.files || []).filter(f => Number(f.serial) !== Number(rec.serial));
    buildRecordsFromCase();
    renderRecords();
    window.Toast.success('הקובץ נמחק');
  }

  function openReminderPopup(rec, anchor) {
    const pop = $('#reminder-pop');
    pop.innerHTML = '';
    pop.style.display = 'block';
    // UI קטן: בעוד X ימים / בתאריך
    const wrap = document.createElement('div');
    wrap.className = 'reminder-popup';
    wrap.innerHTML = `
      <div style="display:flex; gap:8px; align-items:center;">
        <label>בעוד</label>
        <input type="number" min="1" max="365" value="3" style="width:60px" id="rem-in-days"/>
        <span>ימים</span>
        <button type="button" id="rem-apply-in">הפעל</button>
      </div>
      <div style="margin-top:8px; display:flex; gap:8px; align-items:center;">
        <label>בתאריך</label>
        <input type="date" id="rem-on-date"/>
        <button type="button" id="rem-apply-on">הפעל</button>
      </div>
      <div style="margin-top:8px;">
        <button type="button" id="rem-clear">נקה תזכורת</button>
        <button type="button" id="rem-close" style="float:inline-end">סגור</button>
      </div>
    `;
    pop.appendChild(wrap);
    positionPopup(pop, anchor);

    const close = () => { pop.style.display = 'none'; pop.innerHTML = ''; };

    $('#rem-apply-in').onclick = async () => {
      const days = Number($('#rem-in-days').value || 0);
      if (!days) return;
      await patchTaskReminder(rec.serial, { inDays: days });
      rec.reminder = { inDays: days };
      renderRecords();
      close();
    };
    $('#rem-apply-on').onclick = async () => {
      const dt = $('#rem-on-date').value;
      if (!dt) return;
      await patchTaskReminder(rec.serial, { onDate: dt });
      rec.reminder = { onDate: dt };
      renderRecords();
      close();
    };
    $('#rem-clear').onclick = async () => {
      await patchTaskReminder(rec.serial, null);
      rec.reminder = false;
      renderRecords();
      close();
    };
    $('#rem-close').onclick = close;
  }

  function positionPopup(pop, anchor) {
    const r = anchor.getBoundingClientRect();
    pop.style.position = 'fixed';
    pop.style.top = `${r.bottom + 6}px`;
    pop.style.left = `${r.left}px`;
    pop.style.zIndex = 9999;
  }

  async function patchTaskReminder(taskSerial, reminder) {
    const res = await window.API.patchJson(`/update_task?serial=${encodeURIComponent(taskSerial)}`, { reminder });
    if (!res?.success) throw new Error(res?.error || 'עדכון תזכורת נכשל');
    window.Toast.success('התזכורת עודכנה');
  }

  // ---------- Note bar (Create task) ----------
  function bindNoteBar() {
    const btn = $('#addNoteBtn');
    const input = $('#noteInput');
    if (!btn || !input) return;

    const submit = async () => {
      const text = input.value.trim();
      if (!text) return;
      const payload = {
        case_serial: CASE.serial,
        description: text,
        created_at: window.utils?.buildLocalTimestamp?.() || ''
      };
      const res = await window.API.postJson('/create_new_task', payload);
      if (!res?.success) return window.Toast.danger(res?.error || 'יצירת הערה נכשלה');
      // צפה שה־API מחזיר serial חדש
      const newSerial = res.data?.serial || res.data || null;
      CASE.tasks = CASE.tasks || [];
      CASE.tasks.unshift({
        serial: newSerial, description: text, created_at: payload.created_at,
        user: CASE.user, reminder: false
      });
      input.value = '';
      buildRecordsFromCase();
      renderRecords();
      window.Toast.success('הערה נוספה');
    };

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  }

  // ---------- Upload (immediate) ----------
  function bindUploaders() {
    const drop = $('#dropzone');
    const pick = $('#filePicker');
    if (!drop || !pick) return;

    if (drop.dataset.uploadReady) return; // למניעת רישום כפול
    drop.dataset.uploadReady = '1';

    const on = (el, ev, fn) => el.addEventListener(ev, fn);

    // Drag UI
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
      on(drop, ev, (e) => { e.preventDefault(); e.stopPropagation(); });
    });
    on(drop, 'dragover', () => drop.classList.add('dragover'));
    on(drop, 'dragleave', () => drop.classList.remove('dragover'));
    on(drop, 'drop', (e) => {
      drop.classList.remove('dragover');
      const files = e.dataTransfer?.files;
      if (files?.length) enqueueFiles(files);
    });

    // Click to pick
    on(drop, 'click', () => pick.click());
    on(pick, 'change', () => {
      const files = pick.files;
      if (files?.length) enqueueFiles(files);
      pick.value = '';
    });

    let chain = Promise.resolve();
    function enqueueFiles(fileList) {
      Array.from(fileList).forEach(file => {
        chain = chain
          .then(() => uploadSingle(file))
          .catch(err => console.error('upload chain error', err));
      });
    }

    async function getOfficeSerial() {
      const res = await window.API.getJson('/get_office_serial');
      if (!res?.success || !res.data?.office_serial) throw new Error('office_serial לא נמצא');
      return res.data.office_serial;
    }

    async function uploadSingle(file) {
      if (!file?.name) return;
      const office_serial = await getOfficeSerial();
      const ts = window.utils?.buildLocalTimestamp?.() || '';

      window.Toast.info(`מעלה "${file.name}" ...`);

      // 1) create file record (Mongo)
      const created = await window.API.postJson('/create_new_file', {
        created_at: ts, case_serial: CASE.serial, client_serial: "",
        name: file.name, technical_type: file.type || 'application/octet-stream',
        content_type: null, description: ""
      });
      if (!created?.success) { window.Toast.danger(created?.error || 'יצירת רשומת קובץ נכשלה'); return; }
      const file_serial = created.data?.serial || created.data;
      if (!file_serial) { window.Toast.danger('חסר file_serial מהשרת'); return; }

      // 2) presign POST
      const key = `uploads/${office_serial}/${CASE.serial}/${file_serial}/${file.name}`;
      const ps = await window.API.postJson('/presign/post', { key, content_type: file.type || 'application/octet-stream' });
      if (!ps?.success || !ps.data?.url || !ps.data?.fields) {
        window.Toast.danger(ps?.error || 'קבלת presign POST נכשלה'); return;
      }

      // 3) upload to S3
      await uploadViaPresignedPost(ps.data.url, ps.data.fields, file);

      // 4) mark file available
      await window.API.patchJson(`/update_file?serial=${file_serial}`, { status: 'available' }).catch(() => { });

      // 5) add to case.files
      await window.API.patchJson(`/update_case?serial=${CASE.serial}`, { _operator: '$addToSet', files_serials: Number(file_serial) }).catch(() => { });

      // 6) עדכון מקומי + רענון רשימה
      CASE.files = CASE.files || [];
      CASE.files.unshift({
        serial: Number(file_serial),
        name: file.name,
        created_at: ts,
        technical_type: file.type || 'application/octet-stream',
        user: CASE.user,
        description: ""
      });
      buildRecordsFromCase();
      renderRecords();
      window.Toast.success(`"${file.name}" הועלה`);
    }

    async function uploadViaPresignedPost(url, fields, file) {
      const form = new FormData();
      Object.entries(fields).forEach(([k, v]) => form.append(k, v));
      form.append('file', file);
      const resp = await fetch(url, { method: 'POST', body: form });
      if (!resp.ok) throw new Error(`S3 upload failed: ${resp.status}`);
    }
  }

  // ---------- Inline editor infra ----------
  function attachInlineEditor(span, onCommit, { multiline = false } = {}) {
    if (!span) return;

    const startEdit = () => {
      if (span.dataset.editing) return;

      span.dataset.editing = '1';
      span.classList.add('editing');

      const old = span.textContent === '—' ? '' : span.textContent;
      const input = multiline ? document.createElement('textarea') : document.createElement('input');
      input.value = old;
      input.className = 'inline-input';

      const updateWidth = () => {
        input.style.width = (input.value.length + 1) + "ch";
      };
      updateWidth();
      input.addEventListener("input", updateWidth);

      span.replaceChildren(input);
      input.focus();



      const commit = async () => {
        const val = input.value.trim();
        if (val === old) return cancel();
        try {
          await onCommit(val);
          span.textContent = val || '—';
        } catch (e) {
          window.Toast.danger(e?.message || 'שמירה נכשלה');
          span.textContent = old || '—';
        } finally {
          delete span.dataset.editing;
          span.classList.remove('editing');
        }
      };

      const cancel = () => {
        span.textContent = old || '—';
        delete span.dataset.editing;
        span.classList.remove('editing');
      };

      input.addEventListener('keydown', (e) => {
        if (!multiline && e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      });

      input.addEventListener('blur', () => { if (!multiline) cancel(); });
      if (multiline) {
        // במולטיליין – נשמור ב־blur
        input.addEventListener('blur', commit);
      }
    };

    span.addEventListener('click', startEdit);
  }

  // ---------- Helpers ----------
  // (אין merge אמיתי כרגע; רק UI)
  // (confirm-pop מותאם כרגע ל-window.confirm כדי לרוץ מהר)

  // ---------- Public ----------
  window.init_view_case = init_view_case;
})();
