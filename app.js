// ============================================================
// APP.JS — Main Application Logic
// ============================================================

// ── State ──────────────────────────────────────────────────
let currentUser    = null;   // Firebase auth user
let currentProfile = null;   // profile from Firebase /workers
let currentRequestId = null;
let calYear, calMonth;
let myRequests   = [];
let allRequests  = [];
let authLogoutTimer = null;  // debounce למניעת ניתוק מוטעה

// ── Init ───────────────────────────────────────────────────
window.addEventListener('load', () => {
  firebase.initializeApp(FIREBASE_CONFIG);
  const auth = firebase.auth();
  initDB(firebase.database());
  emailjs.init(EMAILJS_PUBLIC_KEY);

  const now = new Date();
  calYear   = now.getFullYear();
  calMonth  = now.getMonth();

  // Auth state listener
  auth.onAuthStateChanged(async user => {
    if (user) {
      // ביטול כל timer ניתוק ממתין — המשתמש עדיין מחובר
      if (authLogoutTimer) { clearTimeout(authLogoutTimer); authLogoutTimer = null; }

      // אם כבר מחובר עם אותו משתמש — לא צריך לאתחל מחדש
      if (currentUser && currentUser.uid === user.uid) return;

      showLoading(true);
      const profile = await getWorkerByAuthEmail(user.email.toLowerCase());
      if (!profile) {
        await auth.signOut();
        showLoading(false);
        showToast('❌ אין לך הרשאה להיכנס למערכת', 'error');
        return;
      }
      if (profile.active === false) {
        await auth.signOut();
        showLoading(false);
        showToast('❌ חשבון זה אינו פעיל במערכת', 'error');
        return;
      }
      currentUser    = user;
      currentProfile = { uid: user.uid, authEmail: user.email.toLowerCase(), ...profile };

      await updateWorker(profile.id, { uid: user.uid, photoURL: user.photoURL || '' });

      showView('mainView');
      setupMainView();
      showLoading(false);

    } else {
      // Firebase מקבל null לרגע קצר עקב COOP/popup — ממתינים 4 שניות לפני ניתוק
      if (authLogoutTimer) clearTimeout(authLogoutTimer);
      authLogoutTimer = setTimeout(() => {
        // בדוק שוב שהמשתמש באמת לא מחובר לפני ניתוק
        if (!firebase.auth().currentUser) {
          currentUser    = null;
          currentProfile = null;
          firebase.database().ref().off();
          showView('loginView');
        }
        authLogoutTimer = null;
      }, 4000); // 4 שניות grace period
    }
  });

  // Login
  document.getElementById('btnGoogleLogin').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err =>
      showToast('שגיאה בכניסה: ' + err.message, 'error')
    );
  });

  // Logout
  document.getElementById('btnLogout').addEventListener('click', () =>
    firebase.auth().signOut()
  );

  // Modal close — overlay click or ✕ button
  document.querySelectorAll('[data-close]').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close))
  );
  document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    })
  );

  // New request form submit
  document.getElementById('formNewRequest').addEventListener('submit', handleSubmitRequest);
});

// ── Setup Main View ────────────────────────────────────────
function setupMainView() {
  document.getElementById('userName').textContent = currentProfile.name;
  if (currentUser.photoURL)
    document.getElementById('userAvatar').src = currentUser.photoURL;

  if (currentProfile.isAdmin && !document.getElementById('btnAdmin')) {
    const a = document.createElement('a');
    a.id = 'btnAdmin';
    a.href = 'admin.html';
    a.target = '_blank';
    a.textContent = '⚙️ ניהול עובדים';
    a.style.cssText = 'background:#6c757d;color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;text-decoration:none;font-weight:600';
    const topbarUser = document.querySelector('.topbar-user');
    topbarUser.insertBefore(a, document.getElementById('btnLogout'));
  }

  if (currentProfile.role === 'manager') setupManagerView();
  else                                    setupCoordinatorView();
}

// ════════════════════════════════════════════════════════════
//  COORDINATOR VIEW
// ════════════════════════════════════════════════════════════
function setupCoordinatorView() {
  document.getElementById('managerTabs').style.display    = 'none';
  document.getElementById('tabMyVacations').style.display = 'block';
  document.getElementById('tabAllRequests').style.display = 'none';
  document.getElementById('tabAnnouncement').style.display = 'none';

  document.getElementById('btnTableView').addEventListener('click', () => switchDisplay('table'));
  document.getElementById('btnCalView').addEventListener('click',   () => switchDisplay('calendar'));
  document.getElementById('btnNewRequest').addEventListener('click', openNewRequestModal);
  document.getElementById('calPrev').addEventListener('click', prevMonth);
  document.getElementById('calNext').addEventListener('click', nextMonth);

  // Real-time listener — my requests
  listenToUserRequests(currentUser.uid, list => {
    myRequests = list;
    renderMyRequestsTable(list);
    renderCalendar();
  });

  loadAnnouncementsForUser();
}

// ════════════════════════════════════════════════════════════
//  MANAGER VIEW
// ════════════════════════════════════════════════════════════
function setupManagerView() {
  document.getElementById('managerTabs').style.display = 'flex';

  // Tab switching
  document.querySelectorAll('.nav-tab').forEach(tab =>
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      switchManagerTab(tab.dataset.tab);
    })
  );

  // View toggles + calendar for "My Vacations" tab
  document.getElementById('btnTableView').addEventListener('click', () => switchDisplay('table'));
  document.getElementById('btnCalView').addEventListener('click',   () => switchDisplay('calendar'));
  document.getElementById('btnNewRequest').addEventListener('click', openNewRequestModal);
  document.getElementById('calPrev').addEventListener('click', prevMonth);
  document.getElementById('calNext').addEventListener('click', nextMonth);

  // Real-time listeners
  // 1) Requests where managerAuthEmail = this manager's Gmail
  listenToManagerRequests(currentUser.email, list => {
    allRequests = list;
    renderAllRequestsTable(list);
  });
  // 2) Manager's own vacation requests
  listenToUserRequests(currentUser.uid, list => {
    myRequests = list;
    renderMyRequestsTable(list);
    renderCalendar();
  });

  setupAnnouncementTab();
  switchManagerTab('allRequests');
}

function switchManagerTab(tab) {
  document.getElementById('tabMyVacations').style.display  = tab === 'myVacations'  ? 'block' : 'none';
  document.getElementById('tabAllRequests').style.display  = tab === 'allRequests'  ? 'block' : 'none';
  document.getElementById('tabAnnouncement').style.display = tab === 'announcement' ? 'block' : 'none';
}

function prevMonth() { if (--calMonth < 0)  { calMonth = 11; calYear--; } renderCalendar(); }
function nextMonth() { if (++calMonth > 11) { calMonth = 0;  calYear++; } renderCalendar(); }

// ════════════════════════════════════════════════════════════
//  RENDER — Tables
// ════════════════════════════════════════════════════════════
function renderMyRequestsTable(requests) {
  const tbody = document.getElementById('myRequestsBody');
  if (!requests.length) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state"><div class="icon">📭</div><p>אין בקשות עדיין — לחץ על ＋ בקשה חדשה</p></div>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = requests.map(r => `
    <tr>
      <td>${formatDates(r.dates)}</td>
      <td style="text-align:center">${calcTotalDays(r.dates)}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(r.reason || '')}</td>
      <td>${statusBadge(r.status)}</td>
      <td><button class="btn btn-outline btn-sm" onclick="openRequestDetail('${r.id}')">פרטים</button></td>
    </tr>`).join('');
}

function renderAllRequestsTable(requests) {
  const tbody = document.getElementById('allRequestsBody');
  if (!requests.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state"><div class="icon">📭</div><p>אין בקשות ממתינות</p></div>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = requests.map(r => `
    <tr>
      <td><strong>${escHtml(r.userName)}</strong></td>
      <td>${formatDates(r.dates)}</td>
      <td style="text-align:center">${calcTotalDays(r.dates)}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(r.reason || '')}</td>
      <td>${statusBadge(r.status)}</td>
      <td><button class="btn btn-outline btn-sm" onclick="openRequestDetail('${r.id}')">טפל</button></td>
    </tr>`).join('');
}

// ════════════════════════════════════════════════════════════
//  CALENDAR
// ════════════════════════════════════════════════════════════
function switchDisplay(mode) {
  document.getElementById('tableView').style.display    = mode === 'table'    ? 'block' : 'none';
  document.getElementById('calendarView').style.display = mode === 'calendar' ? 'block' : 'none';
  document.getElementById('btnTableView').classList.toggle('active', mode === 'table');
  document.getElementById('btnCalView').classList.toggle('active',   mode === 'calendar');
  if (mode === 'calendar') renderCalendar();
}

function renderCalendar() {
  const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const HE_DAYS   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];

  document.getElementById('calMonthTitle').textContent = `${HE_MONTHS[calMonth]} ${calYear}`;

  // Day-of-week headers
  document.getElementById('calHeaders').innerHTML =
    HE_DAYS.map(d => `<div class="cal-header-cell">${d}</div>`).join('');

  const firstDow    = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today       = new Date();
  const cells       = document.getElementById('calCells');
  cells.innerHTML   = '';

  // Empty cells before first day
  for (let i = 0; i < firstDow; i++)
    cells.innerHTML += `<div class="cal-cell other-month"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d;

    const events = myRequests.filter(r =>
      r.dates && r.dates.some(range => dateStr >= range.startDate && dateStr <= range.endDate)
    );

    cells.innerHTML += `
      <div class="cal-cell${isToday ? ' today' : ''}">
        <div class="cal-day-num">${d}</div>
        ${events.map(r => `
          <div class="cal-event ${r.status}" onclick="openRequestDetail('${r.id}')" title="${escHtml(r.reason||'')}">
            ${r.status === 'approved' ? '✅' : r.status === 'rejected' ? '❌' : '🟡'} חופשה
          </div>`).join('')}
      </div>`;
  }
}

// ════════════════════════════════════════════════════════════
//  NEW REQUEST MODAL
// ════════════════════════════════════════════════════════════
function openNewRequestModal() {
  document.getElementById('reqUserName').value = currentProfile.name;
  document.getElementById('reqDate').value     = todayISO();
  buildApprovalTable();
  resetDateRows();
  openModal('modalNewRequest');
}

function buildApprovalTable() {
  const tbody = document.getElementById('reqApprovalBody');
  if (currentProfile.managerName) {
    tbody.innerHTML = `
      <tr>
        <td>${escHtml(currentProfile.department || 'עובד/ת')}</td>
        <td>${escHtml(currentProfile.managerName)}</td>
        <td><input type="text" placeholder="הערה" style="width:100%;border:1px solid #ddd;padding:5px;border-radius:4px;font-size:13px" /></td>
      </tr>`;
  } else {
    tbody.innerHTML = `<tr><td colspan="3" style="color:#888;font-size:13px;padding:8px">אין ממונה מוגדר</td></tr>`;
  }
}

function resetDateRows() {
  const container = document.getElementById('reqDatesContainer');
  // Keep only first row
  const rows = container.querySelectorAll('.date-range-row');
  rows.forEach((r, i) => { if (i > 0) r.remove(); });
  // Clear first row values
  const first = container.querySelector('.date-range-row');
  if (first) {
    first.querySelectorAll('input').forEach(i => { i.value = ''; });
  }
  document.getElementById('reqDaysCounter').style.display = 'none';
  setupDateRows();
}

function setupDateRows() {
  const container = document.getElementById('reqDatesContainer');
  const addBtn    = document.getElementById('reqAddDate');
  const counter   = document.getElementById('reqDaysCounter');

  const updateCounter = () => {
    let total = 0;
    container.querySelectorAll('.date-range-row').forEach(row => {
      const s = row.querySelector('.req-start-date')?.value;
      const e = row.querySelector('.req-end-date')?.value;
      if (s && e && e >= s)
        total += Math.round((new Date(e) - new Date(s)) / 86400000) + 1;
    });
    counter.textContent    = total > 0 ? `סה"כ ${total} ימי חופשה` : '';
    counter.style.display  = total > 0 ? 'block' : 'none';
  };

  const attachRow = row => {
    row.querySelectorAll('input[type=date]').forEach(i => i.addEventListener('change', updateCounter));
    const rmBtn = row.querySelector('.btn-remove-date');
    if (rmBtn) rmBtn.addEventListener('click', () => { row.remove(); updateCounter(); });
  };

  attachRow(container.querySelector('.date-range-row'));

  // Reassign addBtn listener (remove old one by cloning)
  const newBtn = addBtn.cloneNode(true);
  addBtn.parentNode.replaceChild(newBtn, addBtn);
  newBtn.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'form-row date-range-row';
    row.innerHTML = `
      <div class="form-group"><label>מתאריך:</label><input type="date" class="req-start-date" required /></div>
      <div class="form-group"><label>עד תאריך:</label><input type="date" class="req-end-date" required /></div>
      <button type="button" class="btn-remove-date">−</button>`;
    container.appendChild(row);
    attachRow(row);
  });
}

// ── Submit ─────────────────────────────────────────────────
async function handleSubmitRequest(e) {
  e.preventDefault();
  const p = currentProfile;

  const dates = collectDates();
  if (!dates.length) { showToast('יש להזין לפחות תאריך אחד', 'error'); return; }

  showLoading(true);
  try {
    const isManager = p.role === 'manager';

    const requestData = {
      userId:           currentUser.uid,
      userName:         p.name,
      userWorkEmail:    p.workEmail,
      // Manager's details (for routing + email)
      managerAuthEmail: isManager ? (p.managerAuthEmail || null) : p.managerAuthEmail,
      managerName:      isManager ? (p.managerName      || null) : p.managerName,
      managerWorkEmail: isManager ? (p.managerWorkEmail || null) : p.managerWorkEmail,
      reason:           document.getElementById('reqReason').value.trim(),
      activities:       document.getElementById('reqActivities').value.trim(),
      dates,
      status:           'pending',
      createdAt:        Date.now(),
      updatedAt:        Date.now()
    };

    const reqId = await createRequest(requestData);

    // Notify manager by email (if there is one)
    if (requestData.managerWorkEmail) {
      await notifyManagerNewRequest({ ...requestData, id: reqId });
    }

    closeModal('modalNewRequest');
    showToast('✅ הבקשה נשלחה בהצלחה!', 'success');
  } catch (err) {
    console.error(err);
    showToast('שגיאה בשליחת הבקשה', 'error');
  }
  showLoading(false);
}

function collectDates() {
  const result = [];
  document.querySelectorAll('#reqDatesContainer .date-range-row').forEach(row => {
    const s = row.querySelector('.req-start-date')?.value;
    const e = row.querySelector('.req-end-date')?.value;
    if (s && e && e >= s) result.push({ startDate: s, endDate: e });
  });
  return result;
}

// ════════════════════════════════════════════════════════════
//  REQUEST DETAIL MODAL
// ════════════════════════════════════════════════════════════
async function openRequestDetail(requestId) {
  showLoading(true);
  currentRequestId = requestId;
  const req = await getRequest(requestId);
  if (!req) { showLoading(false); return; }

  document.getElementById('detailTitle').textContent = `בקשת חופש — ${req.userName}`;
  document.getElementById('detailInfo').innerHTML = `
    <strong>שם:</strong> ${escHtml(req.userName)}<br>
    <strong>תאריכים:</strong> ${formatDates(req.dates)} (${calcTotalDays(req.dates)} ימים)<br>
    <strong>סיבה:</strong> ${escHtml(req.reason || '—')}<br>
    ${req.activities ? `<strong>פעילות:</strong> ${escHtml(req.activities)}<br>` : ''}
    <strong>הוגש ב:</strong> ${new Date(req.createdAt).toLocaleDateString('he-IL')}
  `;
  document.getElementById('detailStatusWrap').innerHTML = statusBadge(req.status);

  const isManager = currentProfile.role === 'manager';
  const isPending = req.status === 'pending';

  // Manager action buttons
  const actDiv = document.getElementById('managerActions');
  actDiv.style.display = isManager ? 'flex' : 'none';
  document.getElementById('btnApprove').style.display = isPending && isManager ? '' : 'none';
  document.getElementById('btnReject').style.display  = isPending && isManager ? '' : 'none';
  document.getElementById('btnSendMsg').style.display = isManager ? '' : 'none';

  // User reply box (coordinator can reply when pending)
  document.getElementById('replyBox').style.display     = (!isManager && isPending) ? 'block' : 'none';
  document.getElementById('managerMsgBox').style.display = 'none';

  // Render messages
  renderMessages(req.messages ? Object.values(req.messages) : []);

  // Wire buttons
  document.getElementById('btnApprove').onclick   = () => approveRequest(req);
  document.getElementById('btnReject').onclick    = () => openRejectModal(req);
  document.getElementById('btnSendMsg').onclick   = () => {
    const box = document.getElementById('managerMsgBox');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
  };
  document.getElementById('btnSendManagerMsg').onclick = () => sendManagerMessage(req);
  document.getElementById('btnSendReply').onclick      = () => sendUserReply(req);

  openModal('modalRequestDetail');
  showLoading(false);
}

function renderMessages(messages) {
  const thread = document.getElementById('messageThread');
  if (!messages.length) {
    thread.innerHTML = `<p style="color:#888;font-size:13px;text-align:center;padding:12px">אין הודעות בשיחה</p>`;
    return;
  }
  thread.innerHTML = [...messages]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(m => `
      <div>
        <div class="message-bubble from-${m.from}">${escHtml(m.text)}</div>
        <div class="message-meta" style="text-align:${m.from==='manager'?'right':'left'}">
          ${escHtml(m.senderName)} · ${new Date(m.timestamp).toLocaleString('he-IL')}
        </div>
      </div>`).join('');
  thread.scrollTop = thread.scrollHeight;
}

// ── Approve ────────────────────────────────────────────────
async function approveRequest(req) {
  showLoading(true);
  try {
    await updateRequest(req.id, { status: 'approved', updatedAt: Date.now() });
    await notifyUserApproved({ ...req, status: 'approved' });
    closeModal('modalRequestDetail');
    showToast('✅ הבקשה אושרה!', 'success');
  } catch (err) {
    console.error('approveRequest error:', err);
    showToast('שגיאה באישור הבקשה: ' + err.message, 'error');
  } finally {
    showLoading(false); // תמיד מסתיר את ה-loader
  }
}

// ── Reject ─────────────────────────────────────────────────
function openRejectModal(req) {
  document.getElementById('rejectReason').value = '';
  openModal('modalReject');
  document.getElementById('btnConfirmReject').onclick = () => confirmReject(req);
}

async function confirmReject(req) {
  const reason = document.getElementById('rejectReason').value.trim();
  if (!reason) { showToast('יש לכתוב סיבת דחייה', 'error'); return; }
  showLoading(true);
  try {
    await updateRequest(req.id, { status: 'rejected', rejectReason: reason, updatedAt: Date.now() });
    await notifyUserRejected(req, reason);
    closeModal('modalReject');
    showToast('הבקשה נדחתה', 'success');
  } catch (err) {
    console.error(err);
    showToast('שגיאה בדחיית הבקשה', 'error');
  }
  showLoading(false);
}

// ── Manager sends message ──────────────────────────────────
async function sendManagerMessage(req) {
  const text = document.getElementById('managerMsgText').value.trim();
  if (!text) return;
  showLoading(true);
  try {
    await addMessage(req.id, { from: 'manager', senderName: currentProfile.name, text, timestamp: Date.now() });
    await updateRequest(req.id, { updatedAt: Date.now() });
    await notifyUserMessage(req, text, currentProfile.name);
    document.getElementById('managerMsgText').value = '';
    document.getElementById('managerMsgBox').style.display = 'none';
    const updated = await getRequest(req.id);
    renderMessages(updated.messages ? Object.values(updated.messages) : []);
    showToast('💬 הודעה נשלחה', 'success');
  } catch (err) {
    console.error(err);
    showToast('שגיאה בשליחת הודעה', 'error');
  }
  showLoading(false);
}

// ── User replies ───────────────────────────────────────────
async function sendUserReply(req) {
  const text = document.getElementById('replyText').value.trim();
  if (!text) return;
  showLoading(true);
  try {
    await addMessage(req.id, { from: 'user', senderName: currentProfile.name, text, timestamp: Date.now() });
    await updateRequest(req.id, { updatedAt: Date.now() });
    await notifyManagerReply(req, text);
    document.getElementById('replyText').value = '';
    const updated = await getRequest(req.id);
    renderMessages(updated.messages ? Object.values(updated.messages) : []);
    showToast('💬 תגובה נשלחה', 'success');
  } catch (err) {
    console.error(err);
    showToast('שגיאה בשליחת תגובה', 'error');
  }
  showLoading(false);
}

// ════════════════════════════════════════════════════════════
//  ANNOUNCEMENT TAB (Manager)
// ════════════════════════════════════════════════════════════
async function setupAnnouncementTab() {
  const targets = document.getElementById('announcementTargets');
  targets.innerHTML = '<p style="color:#888;font-size:13px">טוען...</p>';

  try {
    const workers = await getAllWorkers();
    const myReports = workers.filter(w =>
      w.active !== false &&
      w.workEmail &&
      w.managerAuthEmail === currentProfile.authEmail
    );
    targets.innerHTML = myReports.length
      ? myReports.map(w => `
          <label style="display:flex;align-items:center;gap:8px;font-weight:normal;cursor:pointer">
            <input type="checkbox" value="${escHtml(w.authEmail || '')}"
                   data-name="${escHtml(w.name)}"
                   data-work-email="${escHtml(w.workEmail)}"
                   style="width:auto;accent-color:#0056b3">
            ${escHtml(w.name)} — ${escHtml(w.workEmail)}
          </label>`).join('')
      : '<p style="color:#888;font-size:13px">אין עובדים מוגדרים תחתיך</p>';
  } catch {
    targets.innerHTML = '<p style="color:red;font-size:13px">שגיאה בטעינת עובדים</p>';
  }

  document.getElementById('btnSendAnnouncement').addEventListener('click', sendAnnouncement);
  loadMyAnnouncements();
}

async function sendAnnouncement() {
  const start = document.getElementById('announcementStart').value;
  const end   = document.getElementById('announcementEnd').value;
  if (!start || !end || end < start) { showToast('יש לבחור תאריכים תקינים', 'error'); return; }

  const checked = [...document.querySelectorAll('#announcementTargets input:checked')];
  if (!checked.length) { showToast('יש לבחור לפחות נמען אחד', 'error'); return; }

  showLoading(true);
  try {
    const targets   = checked.map(cb => ({ authEmail: cb.value, name: cb.dataset.name, workEmail: cb.dataset.workEmail }));
    const visibleTo = [];

    for (const t of targets) {
      if (!t.authEmail) continue;
      const w = await getWorkerByAuthEmail(t.authEmail);
      if (w && w.uid) visibleTo.push(w.uid);
    }

    await createAnnouncement({
      managerId:   currentUser.uid,
      managerName: currentProfile.name,
      startDate:   start,
      endDate:     end,
      visibleTo,
      createdAt:   Date.now()
    });

    await notifyManagerOnVacation({ managerName: currentProfile.name, startDate: start, endDate: end, targets });
    await loadMyAnnouncements();
    showToast('📢 הודעה נשלחה לרכזים!', 'success');
  } catch (err) {
    console.error(err);
    showToast('שגיאה בשליחת הודעה', 'error');
  }
  showLoading(false);
}

async function loadMyAnnouncements() {
  const list = await getMyAnnouncements(currentUser.uid);
  const el   = document.getElementById('myAnnouncementsList');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>אין הודעות שנשלחו</p></div>`;
    return;
  }
  el.innerHTML = list.map(a => `
    <div style="padding:12px;border:1px solid #dee2e6;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
      <span>📅 ${formatDateHE(a.startDate)} — ${formatDateHE(a.endDate)}</span>
      <button class="btn btn-danger btn-sm" onclick="removeAnnouncement('${a.id}')">הסר</button>
    </div>`).join('');
}

async function removeAnnouncement(id) {
  await deleteAnnouncement(id);
  loadMyAnnouncements();
  showToast('הוסר', 'success');
}

async function loadAnnouncementsForUser() {
  const list    = await getAnnouncementsForUser(currentUser.uid);
  const section = document.getElementById('announcementsSection');
  const el      = document.getElementById('announcementsList');
  if (!list.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  el.innerHTML = list.map(a => `
    <div style="padding:10px;background:#e8f0fb;border-radius:8px;margin-bottom:8px;font-size:14px">
      🏖️ <strong>${escHtml(a.managerName)}</strong> בחופשה: ${formatDateHE(a.startDate)} — ${formatDateHE(a.endDate)}
    </div>`).join('');
}

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════
// Firebase שומר מערכים כ-object {0:{...},1:{...}} — נרמול חובה לפני שימוש
function normalizeDates(dates) {
  if (!dates) return [];
  if (Array.isArray(dates)) return dates;
  return Object.values(dates);
}

function statusBadge(status) {
  return {
    pending:  `<span class="badge badge-pending">🟡 ממתין לאישור</span>`,
    approved: `<span class="badge badge-approved">🟢 מאושר</span>`,
    rejected: `<span class="badge badge-rejected">🔴 נדחה</span>`
  }[status] || `<span class="badge">${status}</span>`;
}

function calcTotalDays(dates) {
  return normalizeDates(dates).reduce((sum, d) => {
    if (!d.startDate || !d.endDate || d.endDate < d.startDate) return sum;
    return sum + Math.round((new Date(d.endDate) - new Date(d.startDate)) / 86400000) + 1;
  }, 0);
}

function formatDates(dates) {
  const arr = normalizeDates(dates);
  if (!arr.length) return '—';
  return arr.map(d => {
    const s = formatDateHE(d.startDate);
    const e = formatDateHE(d.endDate);
    return s === e ? s : `${s}–${e}`;
  }).join(', ');
}

function formatDateHE(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Modal helpers ──────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open');    }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showLoading(on) {
  document.getElementById('loadingOverlay').classList.toggle('show', on);
}

function showToast(msg, type = '') {
  const t     = document.getElementById('toast');
  t.textContent = msg;
  t.className = type ? `show ${type}` : 'show';
  setTimeout(() => { t.className = type || ''; }, 3500);
}
