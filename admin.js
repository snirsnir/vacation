// ============================================================
// ADMIN.JS — Worker Management
// ============================================================

let adminUser        = null;
let allWorkersList   = [];
let editingWorkerId  = null;
let adminLogoutTimer = null;

// ── Seed Data (from workers.csv) ───────────────────────────
const WORKERS_SEED = [
  // ── הנהלה ──
  { name: "גדי מדור",        workEmail: "gadi1@technoda.org.il",         authEmail: "gadimador@gmail.com",         role: "manager",     department: "הנהלה",   managerAuthEmail: null,                     managerName: null,          managerWorkEmail: null,                       isAdmin: true  },
  { name: "אמילי גולן",      workEmail: "emily@technoda.org.il",         authEmail: "emilygolan1@gmail.com",       role: "manager",     department: "הנהלה",   managerAuthEmail: "gadimador@gmail.com",    managerName: "גדי מדור",    managerWorkEmail: "gadi1@technoda.org.il",    isAdmin: true  },
  // ── שיווק ──
  { name: "קרן דהן",         workEmail: "keren.dahan@technoda.org.il",   authEmail: "kerenbaileydahan@gmail.com",  role: "manager",     department: "שיווק",   managerAuthEmail: "emilygolan1@gmail.com",  managerName: "אמילי גולן",  managerWorkEmail: "emily@technoda.org.il",    isAdmin: false },
  { name: "יונת נחשון",      workEmail: "yonat@technoda.org.il",         authEmail: "yonatnahshon@gmail.com",      role: "coordinator", department: "שיווק",   managerAuthEmail: "kerenbaileydahan@gmail.com", managerName: "קרן דהן", managerWorkEmail: "keren.dahan@technoda.org.il", isAdmin: false },
  { name: "דלית דרוקר דבי",  workEmail: "dahleet@technoda.org.il",       authEmail: null,                          role: "coordinator", department: "שיווק",   managerAuthEmail: "kerenbaileydahan@gmail.com", managerName: "קרן דהן", managerWorkEmail: "keren.dahan@technoda.org.il", isAdmin: false },
  { name: "דרור",            workEmail: "dror@technoda.org.il",          authEmail: null,                          role: "coordinator", department: "שיווק",   managerAuthEmail: "kerenbaileydahan@gmail.com", managerName: "קרן דהן", managerWorkEmail: "keren.dahan@technoda.org.il", isAdmin: false },
  // ── משרד ──
  { name: "דינה כחלון בש",   workEmail: "dina@technoda.org.il",          authEmail: "dinaka2611@gmail.com",        role: "coordinator", department: "משרד",    managerAuthEmail: "emilygolan1@gmail.com",  managerName: "אמילי גולן",  managerWorkEmail: "emily@technoda.org.il",    isAdmin: false },
  // ── אחזקה ──
  { name: "מידן קדוש",       workEmail: "meidan@technoda.org.il",        authEmail: "meidankadosh@gmail.com",      role: "manager",     department: "אחזקה",   managerAuthEmail: "emilygolan1@gmail.com",  managerName: "אמילי גולן",  managerWorkEmail: "emily@technoda.org.il",    isAdmin: false },
  { name: "יוסי בכר",        workEmail: "yosi@technoda.org.il",          authEmail: null,                          role: "coordinator", department: "אחזקה",   managerAuthEmail: "meidankadosh@gmail.com", managerName: "מידן קדוש",   managerWorkEmail: "meidan@technoda.org.il",   isAdmin: false },
  { name: "תובל מור",        workEmail: "tuval@technoda.org.il",         authEmail: null,                          role: "coordinator", department: "אחזקה",   managerAuthEmail: "meidankadosh@gmail.com", managerName: "מידן קדוש",   managerWorkEmail: "meidan@technoda.org.il",   isAdmin: false },
  { name: "משה סלמה",        workEmail: null,                            authEmail: null,                          role: "coordinator", department: "אחזקה",   managerAuthEmail: "meidankadosh@gmail.com", managerName: "מידן קדוש",   managerWorkEmail: "meidan@technoda.org.il",   isAdmin: false },
  { name: "יצחק",            workEmail: null,                            authEmail: null,                          role: "coordinator", department: "אחזקה",   managerAuthEmail: "meidankadosh@gmail.com", managerName: "מידן קדוש",   managerWorkEmail: "meidan@technoda.org.il",   isAdmin: false },
  { name: "מוטי",            workEmail: null,                            authEmail: null,                          role: "coordinator", department: "אחזקה",   managerAuthEmail: "meidankadosh@gmail.com", managerName: "מידן קדוש",   managerWorkEmail: "meidan@technoda.org.il",   isAdmin: false },
  { name: "זוהר אזרחי",      workEmail: "zohar@technoda.org.il",         authEmail: null,                          role: "coordinator", department: "אחזקה",   managerAuthEmail: "meidankadosh@gmail.com", managerName: "מידן קדוש",   managerWorkEmail: "meidan@technoda.org.il",   isAdmin: false },
  // ── כספים ──
  { name: "שולי ששון",        workEmail: "shuli@technoda.org.il",         authEmail: "shulisason@gmail.com",        role: "manager",     department: "כספים",   managerAuthEmail: "gadimador@gmail.com",    managerName: "גדי מדור",    managerWorkEmail: "gadi1@technoda.org.il",    isAdmin: false },
  { name: "רונית יאיר",       workEmail: "ronit@technoda.org.il",         authEmail: null,                          role: "coordinator", department: "כספים",   managerAuthEmail: "shulisason@gmail.com",   managerName: "שולי ששון",   managerWorkEmail: "shuli@technoda.org.il",    isAdmin: false },
  // ── משאבים ──
  { name: "ספיר מלמד",        workEmail: "sapir@technoda.org.il",         authEmail: "melamedsapir@gmail.com",      role: "coordinator", department: "משאבים",  managerAuthEmail: "gadimador@gmail.com",    managerName: "גדי מדור",    managerWorkEmail: "gadi1@technoda.org.il",    isAdmin: false },
  // ── אקדמי ──
  { name: "מעיין שוורצר",     workEmail: "maayan.s@technoda.org.il",      authEmail: "maayan.schvartzer@gmail.com", role: "manager",     department: "אקדמי",   managerAuthEmail: "emilygolan1@gmail.com",  managerName: "אמילי גולן",  managerWorkEmail: "emily@technoda.org.il",    isAdmin: false },
  { name: "שי גלס",           workEmail: "shay@technoda.org.il",          authEmail: "shayglass97@gmail.com",       role: "coordinator", department: "אקדמי",   managerAuthEmail: "maayan.schvartzer@gmail.com", managerName: "מעיין שוורצר", managerWorkEmail: "maayan.s@technoda.org.il", isAdmin: false },
  { name: "ויטה אגאייב",      workEmail: "vita@technoda.org.il",          authEmail: "agaev.vita@gmail.com",        role: "coordinator", department: "אקדמי",   managerAuthEmail: "maayan.schvartzer@gmail.com", managerName: "מעיין שוורצר", managerWorkEmail: "maayan.s@technoda.org.il", isAdmin: false },
  { name: "דוד אוחיון",       workEmail: "david@technoda.org.il",         authEmail: "sokshi@gmail.com",            role: "coordinator", department: "אקדמי",   managerAuthEmail: "maayan.schvartzer@gmail.com", managerName: "מעיין שוורצר", managerWorkEmail: "maayan.s@technoda.org.il", isAdmin: false },
  { name: "ניצן מורן",        workEmail: "nitsan@technoda.org.il",        authEmail: "nitsanm@gmail.com",           role: "coordinator", department: "אקדמי",   managerAuthEmail: "maayan.schvartzer@gmail.com", managerName: "מעיין שוורצר", managerWorkEmail: "maayan.s@technoda.org.il", isAdmin: false },
  { name: "ורד טל",           workEmail: "vered@technoda.org.il",         authEmail: "vered.tal.2006@gmail.com",    role: "coordinator", department: "אקדמי",   managerAuthEmail: "maayan.schvartzer@gmail.com", managerName: "מעיין שוורצר", managerWorkEmail: "maayan.s@technoda.org.il", isAdmin: false },
  { name: "עזריאל שניידר",    workEmail: "azriel@technoda.org.il",        authEmail: "azriel.sch2@gmail.com",       role: "coordinator", department: "אקדמי",   managerAuthEmail: "maayan.schvartzer@gmail.com", managerName: "מעיין שוורצר", managerWorkEmail: "maayan.s@technoda.org.il", isAdmin: false },
  { name: "מרי דהן",          workEmail: "mary@technoda.org.il",          authEmail: "mary.dahan902@gmail.com",     role: "coordinator", department: "אקדמי",   managerAuthEmail: "maayan.schvartzer@gmail.com", managerName: "מעיין שוורצר", managerWorkEmail: "maayan.s@technoda.org.il", isAdmin: false },
  { name: "אלי זריהן",        workEmail: "eli@technoda.org.il",           authEmail: "zrihaneli@gmail.com",         role: "coordinator", department: "אקדמי",   managerAuthEmail: "maayan.schvartzer@gmail.com", managerName: "מעיין שוורצר", managerWorkEmail: "maayan.s@technoda.org.il", isAdmin: false },
  { name: "שניר דואני",       workEmail: "snir@technoda.org.il",          authEmail: "snirdoani@gmail.com",         role: "coordinator", department: "אקדמי",   managerAuthEmail: "maayan.schvartzer@gmail.com", managerName: "מעיין שוורצר", managerWorkEmail: "maayan.s@technoda.org.il", isAdmin: false },
  { name: "יעלה חדד",         workEmail: "yeela@technoda.org.il",         authEmail: "lilachh16@gmail.com",         role: "coordinator", department: "אקדמי",   managerAuthEmail: "maayan.schvartzer@gmail.com", managerName: "מעיין שוורצר", managerWorkEmail: "maayan.s@technoda.org.il", isAdmin: false },
  { name: "איציק חיים",       workEmail: "izhak@technoda.org.il",         authEmail: "izhakhaime@gmail.com",        role: "coordinator", department: "אקדמי",   managerAuthEmail: "maayan.schvartzer@gmail.com", managerName: "מעיין שוורצר", managerWorkEmail: "maayan.s@technoda.org.il", isAdmin: false },
  { name: "לירון אהרן",       workEmail: "liron@technoda.org.il",         authEmail: "lironlidi@gmail.com",         role: "manager",     department: "אקדמי",   managerAuthEmail: "maayan.schvartzer@gmail.com", managerName: "מעיין שוורצר", managerWorkEmail: "maayan.s@technoda.org.il", isAdmin: false },
  { name: "מור וייס",         workEmail: "mor@technoda.org.il",           authEmail: "morklein1@gmail.com",         role: "coordinator", department: "אקדמי",   managerAuthEmail: "maayan.schvartzer@gmail.com", managerName: "מעיין שוורצר", managerWorkEmail: "maayan.s@technoda.org.il", isAdmin: false },
];

// ── Init ───────────────────────────────────────────────────
window.addEventListener('load', () => {
  firebase.initializeApp(FIREBASE_CONFIG);
  const auth = firebase.auth();
  initDB(firebase.database());

  auth.onAuthStateChanged(async user => {
    if (user) {
      if (adminLogoutTimer) { clearTimeout(adminLogoutTimer); adminLogoutTimer = null; }
      if (adminUser && adminUser.uid === user.uid) return;

      if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        await auth.signOut();
        document.getElementById('adminError').style.display = 'block';
        return;
      }
      adminUser = user;
      document.getElementById('adminUserName').textContent = user.displayName || user.email;
      showView('adminView');
      loadWorkers();
    } else {
      // debounce — Firebase popup גורם ל-null רגעי עקב COOP
      if (adminLogoutTimer) clearTimeout(adminLogoutTimer);
      adminLogoutTimer = setTimeout(() => {
        if (!firebase.auth().currentUser) {
          adminUser = null;
          showView('loginView');
        }
        adminLogoutTimer = null;
      }, 4000);
    }
  });

  document.getElementById('btnAdminLogin').addEventListener('click', () => {
    document.getElementById('adminError').style.display = 'none';
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(err =>
      showToast('שגיאה בכניסה: ' + err.message, 'error')
    );
  });

  document.getElementById('btnAdminLogout').addEventListener('click', () =>
    firebase.auth().signOut()
  );

  emailjs.init(EMAILJS_PUBLIC_KEY);

  document.getElementById('deptFilter').addEventListener('change', renderWorkersTable);
  document.getElementById('searchFilter').addEventListener('input', renderWorkersTable);
  document.getElementById('btnAddWorker').addEventListener('click', openAddWorkerModal);
  document.getElementById('btnSeedWorkers').addEventListener('click', seedWorkers);
  document.getElementById('btnSaveWorker').addEventListener('click', saveWorkerForm);
  document.getElementById('btnCancelWorker').addEventListener('click', closeWorkerModal);
  document.getElementById('btnCloseWorkerModal').addEventListener('click', closeWorkerModal);
  document.getElementById('btnSendReport').addEventListener('click', sendManualReport);
  document.getElementById('modalWorker').addEventListener('click', e => {
    if (e.target === document.getElementById('modalWorker')) closeWorkerModal();
  });
});

// ── Load & Render ──────────────────────────────────────────
async function loadWorkers() {
  showLoading(true);
  try {
    allWorkersList = await getAllWorkers();
    renderWorkersTable();
  } catch (err) {
    showToast('שגיאה בטעינת עובדים: ' + err.message, 'error');
  }
  showLoading(false);
}

function renderWorkersTable() {
  const dept   = document.getElementById('deptFilter').value;
  const search = document.getElementById('searchFilter').value.trim().toLowerCase();

  let filtered = allWorkersList;
  if (dept)   filtered = filtered.filter(w => w.department === dept);
  if (search) filtered = filtered.filter(w =>
    (w.name        || '').toLowerCase().includes(search) ||
    (w.workEmail   || '').toLowerCase().includes(search) ||
    (w.authEmail   || '').toLowerCase().includes(search)
  );
  filtered.sort((a, b) => (a.department || '').localeCompare(b.department || '', 'he') || a.name.localeCompare(b.name, 'he'));

  const countEl = document.getElementById('workerCount');
  if (countEl) countEl.textContent = `${filtered.length} עובדים`;

  const tbody = document.getElementById('workersBody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="icon">📭</div><p>אין עובדים</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(w => `
    <tr class="${w.active === false ? 'inactive-row' : ''}">
      <td><strong>${escHtml(w.name)}</strong></td>
      <td><span class="dept-badge">${escHtml(w.department || '—')}</span></td>
      <td style="font-size:12px;direction:ltr;text-align:right">${escHtml(w.workEmail || '—')}</td>
      <td style="font-size:12px;direction:ltr;text-align:right">${w.authEmail ? escHtml(w.authEmail) : '<span style="color:#aaa">—</span>'}</td>
      <td>${w.role === 'manager' ? '👔 מנהל/ת' : '📋 רכז/ת'}</td>
      <td style="font-size:12px">${escHtml(w.managerName || '—')}</td>
      <td>
        <span style="padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600;
          ${w.active === false ? 'background:#f8d7da;color:#721c24' : 'background:#d4edda;color:#155724'}">
          ${w.active === false ? 'לא פעיל' : 'פעיל'}
        </span>
      </td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="openEditWorkerModal('${w.id}')">ערוך</button>
        <button class="btn btn-sm ${w.active === false ? 'btn-success' : 'btn-danger'}"
                style="margin-right:4px"
                onclick="toggleActive('${w.id}', ${w.active !== false})">
          ${w.active === false ? 'הפעל' : 'השבת'}
        </button>
      </td>
    </tr>`).join('');
}

// ── Toggle Active ──────────────────────────────────────────
async function toggleActive(workerId, currentlyActive) {
  const newState = !currentlyActive;
  if (!confirm(`האם ${newState ? 'להפעיל' : 'להשבית'} עובד/ת זה/ז?`)) return;
  showLoading(true);
  try {
    await toggleWorkerActive(workerId, newState);
    await loadWorkers();
    showToast(newState ? 'עובד/ת הופעל/ה' : 'עובד/ת הושבת/ה', 'success');
  } catch (err) {
    showToast('שגיאה: ' + err.message, 'error');
  }
  showLoading(false);
}

// ── Add/Edit Modal ─────────────────────────────────────────
function openAddWorkerModal() {
  editingWorkerId = null;
  document.getElementById('workerModalTitle').textContent = '➕ הוסף עובד/ת';
  document.getElementById('workerForm').reset();
  document.getElementById('workerActive').checked = true;
  document.getElementById('role_coordinator').checked = true;
  populateManagersSelect(null);
  document.getElementById('modalWorker').classList.add('open');
  document.getElementById('workerName').focus();
}

function openEditWorkerModal(workerId) {
  editingWorkerId = workerId;
  const w = allWorkersList.find(x => x.id === workerId);
  if (!w) return;

  document.getElementById('workerModalTitle').textContent = `✏️ ערוך — ${w.name}`;
  document.getElementById('workerName').value      = w.name      || '';
  document.getElementById('workerWorkEmail').value = w.workEmail || '';
  document.getElementById('workerAuthEmail').value = w.authEmail || '';
  document.getElementById('workerDept').value      = w.department || '';
  document.getElementById('workerActive').checked  = w.active !== false;

  const roleId = w.role === 'manager' ? 'role_manager' : 'role_coordinator';
  document.getElementById(roleId).checked = true;

  populateManagersSelect(w.managerAuthEmail);
  document.getElementById('modalWorker').classList.add('open');
}

function populateManagersSelect(selectedAuthEmail) {
  const select = document.getElementById('workerManager');
  select.innerHTML = '<option value="">— ללא ממונה —</option>';

  const managers = allWorkersList
    .filter(w => w.role === 'manager' && w.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));

  managers.forEach(m => {
    const opt = document.createElement('option');
    opt.value             = m.authEmail || '';
    opt.textContent       = `${m.name} (${m.department || ''})`;
    opt.dataset.name      = m.name;
    opt.dataset.workEmail = m.workEmail || '';
    if (m.authEmail && m.authEmail === selectedAuthEmail) opt.selected = true;
    select.appendChild(opt);
  });
}

function closeWorkerModal() {
  document.getElementById('modalWorker').classList.remove('open');
  editingWorkerId = null;
}

async function saveWorkerForm() {
  const name      = document.getElementById('workerName').value.trim();
  const workEmail = document.getElementById('workerWorkEmail').value.trim().toLowerCase() || null;
  const authEmail = document.getElementById('workerAuthEmail').value.trim().toLowerCase() || null;
  const dept      = document.getElementById('workerDept').value || null;
  const role      = document.querySelector('input[name="workerRole"]:checked')?.value || 'coordinator';
  const active    = document.getElementById('workerActive').checked;

  if (!name) { showToast('יש להזין שם מלא', 'error'); return; }

  const managerSelect    = document.getElementById('workerManager');
  const selectedOpt      = managerSelect.options[managerSelect.selectedIndex];
  const managerAuthEmail = managerSelect.value || null;
  const managerName      = managerAuthEmail ? (selectedOpt.dataset.name      || null) : null;
  const managerWorkEmail = managerAuthEmail ? (selectedOpt.dataset.workEmail || null) : null;

  const workerData = {
    name, workEmail, authEmail, department: dept, role,
    managerAuthEmail, managerName, managerWorkEmail,
    active, isAdmin: false
  };

  showLoading(true);
  try {
    if (editingWorkerId) {
      await updateWorker(editingWorkerId, workerData);
      showToast('✅ עובד/ת עודכן/ה', 'success');
    } else {
      await saveWorker({ ...workerData, createdAt: Date.now() });
      showToast('✅ עובד/ת נוסף/ה', 'success');
    }
    closeWorkerModal();
    await loadWorkers();
  } catch (err) {
    showToast('שגיאה בשמירה: ' + err.message, 'error');
  }
  showLoading(false);
}

// ── Seed from CSV ──────────────────────────────────────────
async function seedWorkers() {
  if (!confirm(`ייבא ${WORKERS_SEED.length} עובדים מהרשימה?\nעובדים קיימים (לפי מייל) לא יידרסו.`)) return;

  showLoading(true);
  let added = 0, skipped = 0;
  try {
    const existingEmails = new Set(
      allWorkersList.flatMap(w => [w.workEmail, w.authEmail].filter(Boolean))
    );

    for (const w of WORKERS_SEED) {
      const alreadyExists =
        (w.workEmail && existingEmails.has(w.workEmail)) ||
        (w.authEmail && existingEmails.has(w.authEmail));

      if (alreadyExists) { skipped++; continue; }

      await saveWorker({ ...w, active: true, createdAt: Date.now() });
      added++;
    }

    await loadWorkers();
    showToast(`✅ יובאו ${added} עובדים חדשים (${skipped} קיימים הושמטו)`, 'success');
  } catch (err) {
    showToast('שגיאה בייבוא: ' + err.message, 'error');
  }
  showLoading(false);
}

// ── Manual Monthly Report ──────────────────────────────────
const REPORT_RECIPIENTS = ['shuli@technoda.org.il', 'ronit@technoda.org.il'];

async function sendManualReport() {
  const now      = new Date();
  const year     = now.getFullYear();
  const month    = now.getMonth() + 1;
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                     'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const monthLabel = `${HE_MONTHS[month - 1]} ${year}`;

  if (!confirm(`שלח דוח חופשות לחודש ${monthLabel}\nנמענות: ${REPORT_RECIPIENTS.join(', ')}?`)) return;

  showLoading(true);
  try {
    const snap = await firebase.database().ref('vacationRequests').once('value');
    const data = snap.val();
    if (!data) { showToast('אין נתוני חופשות', 'error'); showLoading(false); return; }

    const firstDay   = `${monthStr}-01`;
    const lastDayNum = new Date(year, month, 0).getDate();
    const lastDay    = `${monthStr}-${String(lastDayNum).padStart(2, '0')}`;

    const relevant = Object.values(data).filter(r => {
      if (!['approved', 'partial'].includes(r.status)) return false;
      const dates = repNormDates(r.dates);
      return dates.some(d => d.startDate <= lastDay && d.endDate >= firstDay);
    });

    if (!relevant.length) {
      showToast(`אין חופשות מאושרות ל-${monthLabel}`, 'error');
      showLoading(false);
      return;
    }

    const byUser = {};
    relevant.forEach(r => {
      const uid = r.userId || r.userName;
      if (!byUser[uid]) byUser[uid] = { name: r.userName, uid: r.userId, requests: [] };
      byUser[uid].requests.push(r);
    });
    const sorted = Object.values(byUser).sort((a, b) => a.name.localeCompare(b.name, 'he'));

    const html    = buildReportHtml(sorted, monthLabel, monthStr, firstDay, lastDay);
    const subject = `דוח חופשות - ${monthLabel} (${sorted.length} עובדים)`;

    for (const toEmail of REPORT_RECIPIENTS) {
      await emailjs.send(
        EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID,
        { to_name: toEmail, name: 'מערכת חופשות טכנודע', email: CALENDAR_GMAIL, subject, message: html },
        EMAILJS_PUBLIC_KEY
      );
    }

    showToast(`דוח נשלח ל-${REPORT_RECIPIENTS.join(', ')}`, 'success');
  } catch (err) {
    console.error(err);
    showToast('שגיאה בשליחת הדוח: ' + err.message, 'error');
  }
  showLoading(false);
}

function buildReportHtml(sorted, monthLabel, monthStr, firstDay, lastDay) {
  const totalEmployees = sorted.length;
  const totalAllDays   = sorted.reduce((s, e) => s + repCalcDays(e.requests, firstDay, lastDay), 0);
  const sysUrl         = typeof SYSTEM_URL !== 'undefined' ? SYSTEM_URL : 'https://snirsnir.github.io/vacation/';

  const rows = sorted.map(emp => {
    const url  = `${sysUrl}report.html?uid=${encodeURIComponent(emp.uid)}&month=${monthStr}`;
    const days = repCalcDays(emp.requests, firstDay, lastDay);
    return `<tr>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;font-size:15px;font-weight:600">
        <a href="${url}" style="color:#0056b3;text-decoration:none">${emp.name}</a>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;font-size:14px;color:#555;text-align:center">
        ${emp.requests.length} בקשות
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;font-size:14px;font-weight:700;color:#0056b3;text-align:center">
        ${days} ימים
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;text-align:center">
        <a href="${url}" style="display:inline-block;background:#0056b3;color:#fff;padding:6px 16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:700">דוח + הדפסה</a>
      </td>
    </tr>`;
  }).join('');

  return `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;direction:rtl;background:#eef2f7;padding:28px 16px;margin:0">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,86,0.10)">
    <div style="background:linear-gradient(135deg,#0056b3 0%,#0077e6 100%);padding:28px 36px;color:#fff;text-align:right">
      <div style="font-size:13px;font-weight:600;opacity:0.8;margin-bottom:6px;letter-spacing:1px;text-transform:uppercase">TECHNODA</div>
      <div style="font-size:22px;font-weight:700;margin-bottom:4px">דוח חופשות חודשי &mdash; ${monthLabel}</div>
      <div style="font-size:14px;opacity:0.85">מערכת חופשות טכנודע | שליחה ידנית</div>
    </div>
    <div style="display:flex;gap:0;border-bottom:1px solid #eee">
      <div style="flex:1;padding:20px 24px;text-align:center;border-left:1px solid #eee">
        <div style="font-size:28px;font-weight:700;color:#0056b3">${totalEmployees}</div>
        <div style="font-size:13px;color:#888;margin-top:4px">עובדים בחופש</div>
      </div>
      <div style="flex:1;padding:20px 24px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:#1a7f4b">${totalAllDays}</div>
        <div style="font-size:13px;color:#888;margin-top:4px">סה"כ ימי חופש</div>
      </div>
    </div>
    <div style="padding:24px 28px">
      <div style="font-size:14px;font-weight:700;color:#555;margin-bottom:14px">רשימת עובדים (לפי א-ב) &mdash; לחץ על שם לדוח מפורט</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#f4f6fa">
            <th style="padding:11px 16px;text-align:right;font-size:13px;color:#555;font-weight:700">שם העובד/ת</th>
            <th style="padding:11px 16px;text-align:center;font-size:13px;color:#555;font-weight:700">בקשות</th>
            <th style="padding:11px 16px;text-align:center;font-size:13px;color:#555;font-weight:700">ימי חופש</th>
            <th style="padding:11px 16px;text-align:center;font-size:13px;color:#555;font-weight:700">דוח</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="background:#f4f6fa;padding:14px 28px;text-align:center;font-size:12px;color:#bbb;border-top:1px solid #eee">
      מערכת חופשות טכנודע &nbsp;|&nbsp; שליחה ידנית &mdash; ${monthLabel}
    </div>
  </div>
</div>`;
}

function repNormDates(dates) {
  if (!dates) return [];
  if (Array.isArray(dates)) return dates;
  return Object.values(dates);
}

function repCalcDays(requests, firstDay, lastDay) {
  let total = 0;
  requests.forEach(r => {
    repNormDates(r.dates).forEach(d => {
      if (!d.startDate || !d.endDate || d.startDate > lastDay || d.endDate < firstDay) return;
      const start = d.startDate < firstDay ? firstDay : d.startDate;
      const end   = d.endDate   > lastDay  ? lastDay  : d.endDate;
      let cur = new Date(start + 'T00:00:00');
      const fin = new Date(end + 'T00:00:00');
      while (cur <= fin) {
        const dow = cur.getDay();
        if (dow !== 5 && dow !== 6) total++;
        cur.setDate(cur.getDate() + 1);
      }
    });
  });
  return total;
}

// ── Helpers ────────────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showLoading(on) {
  document.getElementById('loadingOverlay').classList.toggle('show', on);
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = type ? `show ${type}` : 'show';
  setTimeout(() => { t.className = type || ''; }, 3500);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}
