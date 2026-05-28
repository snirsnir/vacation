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
  { name: "מידן קדוש",       workEmail: "meidan@technoda.org",           authEmail: "meidankadosh@gmail.com",      role: "manager",     department: "אחזקה",   managerAuthEmail: "emilygolan1@gmail.com",  managerName: "אמילי גולן",  managerWorkEmail: "emily@technoda.org.il",    isAdmin: false },
  { name: "יוסי בכר",        workEmail: "yosi@technoda.org.il",          authEmail: null,                          role: "coordinator", department: "אחזקה",   managerAuthEmail: "meidankadosh@gmail.com", managerName: "מידן קדוש",   managerWorkEmail: "meidan@technoda.org",      isAdmin: false },
  { name: "תובל מור",        workEmail: "tuval@technoda.org.il",         authEmail: null,                          role: "coordinator", department: "אחזקה",   managerAuthEmail: "meidankadosh@gmail.com", managerName: "מידן קדוש",   managerWorkEmail: "meidan@technoda.org",      isAdmin: false },
  { name: "משה סלמה",        workEmail: null,                            authEmail: null,                          role: "coordinator", department: "אחזקה",   managerAuthEmail: "meidankadosh@gmail.com", managerName: "מידן קדוש",   managerWorkEmail: "meidan@technoda.org",      isAdmin: false },
  { name: "יצחק",            workEmail: null,                            authEmail: null,                          role: "coordinator", department: "אחזקה",   managerAuthEmail: "meidankadosh@gmail.com", managerName: "מידן קדוש",   managerWorkEmail: "meidan@technoda.org",      isAdmin: false },
  { name: "מוטי",            workEmail: null,                            authEmail: null,                          role: "coordinator", department: "אחזקה",   managerAuthEmail: "meidankadosh@gmail.com", managerName: "מידן קדוש",   managerWorkEmail: "meidan@technoda.org",      isAdmin: false },
  { name: "זוהר אזרחי",      workEmail: "zohar@technoda.org.il",         authEmail: null,                          role: "coordinator", department: "אחזקה",   managerAuthEmail: "meidankadosh@gmail.com", managerName: "מידן קדוש",   managerWorkEmail: "meidan@technoda.org",      isAdmin: false },
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

  document.getElementById('deptFilter').addEventListener('change', renderWorkersTable);
  document.getElementById('searchFilter').addEventListener('input', renderWorkersTable);
  document.getElementById('btnAddWorker').addEventListener('click', openAddWorkerModal);
  document.getElementById('btnSeedWorkers').addEventListener('click', seedWorkers);
  document.getElementById('btnSaveWorker').addEventListener('click', saveWorkerForm);
  document.getElementById('btnCancelWorker').addEventListener('click', closeWorkerModal);
  document.getElementById('btnCloseWorkerModal').addEventListener('click', closeWorkerModal);
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
