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
let skipFriday     = true;   // האם לדלג על יום שישי בספירת ימי חופש
let currentReqDates  = [];   // dates of the request currently open in the detail modal
let periodActions    = {};   // per-period manager decisions: index → 'approve' | 'reject'
let periodMessages   = {};   // per-period message texts: index → string

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

      // Keep currentProfile in sync — so admin changes take effect without re-login
      listenToWorker(profile.id, updated => {
        if (currentUser) {
          currentProfile = { uid: currentUser.uid, authEmail: currentUser.email.toLowerCase(), ...updated };
        }
      });

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

  // User dropdown toggle
  const _trigger  = document.getElementById('userMenuTrigger');
  const _dropdown = document.getElementById('userDropdown');
  _trigger.addEventListener('click', e => {
    e.stopPropagation();
    _dropdown.classList.toggle('open');
  });
  document.addEventListener('click', () => _dropdown.classList.remove('open'));

  // Modal close — overlay click or ✕ button
  document.querySelectorAll('[data-close]').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close))
  );
  document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    })
  );

  // Changelog modal
  document.getElementById('btnChangelog').addEventListener('click', () => openModal('modalChangelog'));

  // New request form submit
  document.getElementById('formNewRequest').addEventListener('submit', handleSubmitRequest);

  // Friday skip checkbox
  document.getElementById('chkSkipFriday').addEventListener('change', e => {
    skipFriday = e.target.checked;
    document.querySelectorAll('#reqDatesContainer .date-range-row').forEach(row => {
      if (row._pickerRefresh) row._pickerRefresh();
    });
    updateDaysCounter();
  });
});

// ── Setup Main View ────────────────────────────────────────
function setupMainView() {
  document.getElementById('userName').textContent = currentProfile.name;
  if (currentUser.photoURL)
    document.getElementById('userAvatar').src = currentUser.photoURL;

  const hasAdminAccess     = currentProfile.isAdmin || ADMIN_EMAILS.includes(currentProfile.authEmail);
  const hasDashboardAccess = DASHBOARD_EMAILS.includes(currentProfile.authEmail);
  document.getElementById('adminMenuLink').style.display     = hasAdminAccess     ? '' : 'none';
  document.getElementById('dashboardMenuLink').style.display = hasDashboardAccess ? '' : 'none';

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
    const dow     = new Date(calYear, calMonth, d).getDay();
    const isToday = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d;

    const dayHolidays = HOLIDAYS.filter(h => dateStr >= h.start && dateStr <= h.end);
    const events = myRequests.filter(r =>
      normalizeDates(r.dates).some(range => dateStr >= range.startDate && dateStr <= range.endDate)
    );

    let cellClass = 'cal-cell';
    if (isToday)            cellClass += ' today';
    if (dow === 6)          cellClass += ' cal-saturday';
    else if (dow === 5)     cellClass += ' cal-friday';
    if (dayHolidays.length) cellClass += ' cal-holiday-day';

    cells.innerHTML += `
      <div class="${cellClass}">
        <div class="cal-day-num">${d}</div>
        ${dayHolidays.map(h => `<div class="cal-event holiday">${escHtml(h.name)}</div>`).join('')}
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
        <td><input type="text" placeholder="כתוב הערה" style="width:100%;border:1px solid #ddd;padding:5px;border-radius:4px;font-size:13px" /></td>
      </tr>`;
  } else {
    tbody.innerHTML = `<tr><td colspan="3" style="color:#888;font-size:13px;padding:8px">אין ממונה מוגדר</td></tr>`;
  }
}

function resetDateRows() {
  const container = document.getElementById('reqDatesContainer');
  [...container.querySelectorAll('.date-range-row')].forEach((r, i) => { if (i > 0) r.remove(); });
  const first = container.querySelector('.date-range-row');
  if (first) {
    first.querySelector('.req-start-date').value = '';
    first.querySelector('.req-end-date').value   = '';
    createInlinePicker(first);
  }
  document.getElementById('reqDaysCounter').style.display = 'none';
  setupDateRows();
}

function setupDateRows() {
  const addBtn = document.getElementById('reqAddDate');
  const newBtn = addBtn.cloneNode(true);
  addBtn.parentNode.replaceChild(newBtn, addBtn);
  newBtn.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'date-range-row';
    row.innerHTML = `
      <input type="hidden" class="req-start-date">
      <input type="hidden" class="req-end-date">
      <div class="inline-picker">
        <div class="picker-nav">
          <button type="button" class="picker-prev picker-nav-btn">‹</button>
          <span class="picker-month-title"></span>
          <button type="button" class="picker-next picker-nav-btn">›</button>
        </div>
        <div class="picker-headers picker-grid"></div>
        <div class="picker-days picker-grid"></div>
        <div class="picker-label">לחץ על תאריך ההתחלה</div>
      </div>
      <button type="button" class="btn-remove-date" style="margin-top:8px">− הסר תקופה זו</button>`;
    document.getElementById('reqDatesContainer').appendChild(row);
    createInlinePicker(row);
    row.querySelector('.btn-remove-date').addEventListener('click', () => { row.remove(); updateDaysCounter(); });
  });
}

function createInlinePicker(row) {
  const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const HE_DAYS   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];

  const startInput = row.querySelector('.req-start-date');
  const endInput   = row.querySelector('.req-end-date');
  const titleEl    = row.querySelector('.picker-month-title');
  const headersEl  = row.querySelector('.picker-headers');
  const gridEl     = row.querySelector('.picker-days');
  const labelEl    = row.querySelector('.picker-label');

  const now = new Date();
  let cy  = now.getFullYear();
  let cm  = now.getMonth();
  let selStart = startInput.value || null;
  let selEnd   = endInput.value   || null;
  let hoverISO = null;

  headersEl.innerHTML = HE_DAYS.map(d => `<div class="picker-header-cell">${d}</div>`).join('');

  // Apply range classes to a single cell without rebuilding the grid
  function applyRangeClass(cell, iso) {
    cell.classList.remove('sel-start', 'sel-end', 'in-range');
    const compareEnd = selEnd || hoverISO;
    if (selStart && compareEnd) {
      const lo = selStart <= compareEnd ? selStart : compareEnd;
      const hi = selStart <= compareEnd ? compareEnd : selStart;
      if (iso === lo)             cell.classList.add('sel-start');
      if (iso === hi)             cell.classList.add('sel-end');
      if (iso >= lo && iso <= hi) cell.classList.add('in-range');
    } else if (selStart && iso === selStart) {
      cell.classList.add('sel-start');
    }
  }

  // Update range classes on all existing cells (no DOM rebuild)
  function updateRangeClasses() {
    gridEl.querySelectorAll('.picker-cell[data-iso]').forEach(cell => {
      applyRangeClass(cell, cell.dataset.iso);
    });
  }

  function renderGrid() {
    titleEl.textContent = `${HE_MONTHS[cm]} ${cy}`;
    const firstDow    = new Date(cy, cm, 1).getDay();
    const daysInMonth = new Date(cy, cm + 1, 0).getDate();
    const todayStr    = dateToISO(new Date());

    gridEl.innerHTML = '';
    for (let i = 0; i < firstDow; i++) {
      const e = document.createElement('div');
      e.className = 'picker-cell empty';
      gridEl.appendChild(e);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${cy}-${String(cm+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dow = new Date(cy, cm, d).getDay();
      const isDisabled = dow === 6 || isHoliday(iso) || (dow === 5 && skipFriday);

      const cell = document.createElement('div');
      cell.className   = 'picker-cell';
      cell.textContent = d;
      cell.dataset.iso = iso;

      if (isDisabled) {
        cell.classList.add('disabled');
      } else {
        if (dow === 5) cell.classList.add('fri');
        if (iso === todayStr) cell.classList.add('today');
        applyRangeClass(cell, iso);
      }
      gridEl.appendChild(cell);
    }
  }

  function updateLabel() {
    if (selStart && selEnd) {
      const todayISO = dateToISO(new Date());
      const days     = countWorkingDays(selStart, selEnd);
      if (selStart < todayISO) {
        const pastEnd  = selEnd < todayISO ? selEnd : todayISO;
        const pastDays = countWorkingDays(selStart, pastEnd);
        labelEl.textContent = `${formatDateHE(selStart)} – ${formatDateHE(selEnd)}  (${days} ימי חופש, ${pastDays} בדיעבד)`;
        labelEl.className   = 'picker-label past-range';
      } else {
        labelEl.textContent = `${formatDateHE(selStart)} – ${formatDateHE(selEnd)}  (${days} ימי חופש)`;
        labelEl.className   = 'picker-label has-range';
      }
    } else if (selStart) {
      labelEl.textContent = 'כעת בחר את תאריך הסיום...';
      labelEl.className   = 'picker-label selecting';
    } else {
      labelEl.textContent = 'לחץ על תאריך ההתחלה';
      labelEl.className   = 'picker-label';
    }
  }

  // Event delegation on gridEl — avoids per-cell listeners and the destroyed-node click bug
  gridEl.addEventListener('mousemove', e => {
    if (!selStart || selEnd) return;
    const cell = e.target.closest('.picker-cell[data-iso]');
    if (!cell || cell.classList.contains('disabled')) return;
    const iso = cell.dataset.iso;
    if (iso !== hoverISO) {
      hoverISO = iso;
      updateRangeClasses();
    }
  });

  gridEl.addEventListener('mouseleave', () => {
    if (selStart && !selEnd && hoverISO) {
      hoverISO = null;
      updateRangeClasses();
    }
  });

  gridEl.addEventListener('click', e => {
    const cell = e.target.closest('.picker-cell[data-iso]');
    if (!cell || cell.classList.contains('disabled')) return;
    const iso = cell.dataset.iso;

    if (!selStart || selEnd) {
      selStart = iso; selEnd = null; hoverISO = null;
    } else {
      if (iso === selStart) {
        // Same date clicked twice → single-day selection
        selEnd = selStart;
        startInput.value = selStart;
        endInput.value   = selEnd;
        updateLabel(); updateDaysCounter(); updateRangeClasses();
        return;
      }
      const newStart = iso < selStart ? iso    : selStart;
      const newEnd   = iso < selStart ? selStart : iso;

      // Check for overlap with every other row's confirmed range
      const overlap = [...document.querySelectorAll('#reqDatesContainer .date-range-row')]
        .filter(r => r !== row)
        .some(r => {
          const s = r.querySelector('.req-start-date')?.value;
          const en = r.querySelector('.req-end-date')?.value;
          return s && en && newStart <= en && s <= newEnd;
        });

      if (overlap) {
        showToast('⚠️ ימים חופפים — נא בחרו ימים לא חופפים', 'error');
        selStart = null; selEnd = null; hoverISO = null;
        startInput.value = ''; endInput.value = '';
        updateLabel(); updateDaysCounter(); updateRangeClasses();
        return;
      }


      selStart = newStart; selEnd = newEnd; hoverISO = null;
    }
    startInput.value = selStart || '';
    endInput.value   = selEnd   || '';
    updateLabel();
    updateDaysCounter();
    updateRangeClasses();
  });

  row.querySelector('.picker-prev').addEventListener('click', () => {
    if (--cm < 0) { cm = 11; cy--; } renderGrid();
  });
  row.querySelector('.picker-next').addEventListener('click', () => {
    if (++cm > 11) { cm = 0; cy++; } renderGrid();
  });

  row._pickerRefresh = () => { renderGrid(); updateLabel(); };

  updateLabel();
  renderGrid();
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
      userAuthEmail:    p.authEmail,
      // Manager's details (for routing + email)
      managerAuthEmail: isManager ? (p.managerAuthEmail || null) : p.managerAuthEmail,
      managerName:      isManager ? (p.managerName      || null) : p.managerName,
      managerWorkEmail: isManager ? (p.managerWorkEmail || null) : p.managerWorkEmail,
      reason:           document.getElementById('reqReason').value.trim(),
      activities:       document.getElementById('reqActivities').value.trim(),
      approvalNote:     document.querySelector('#reqApprovalBody input[type="text"]')?.value.trim() || '',
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

  const isManager = currentProfile.role === 'manager';
  const isPending = req.status === 'pending';
  const isPartial = req.status === 'partial';
  const reqDates  = normalizeDates(req.dates);

  document.getElementById('detailTitle').textContent = `בקשת חופש — ${req.userName}`;

  // Build dates display — show per-range status when multiple ranges exist
  const datesHtml = reqDates.length > 1
    ? reqDates.map(d => {
        const s = d.status || 'pending';
        const icon = s === 'approved' ? '✅' : s === 'rejected' ? '❌' : '🟡';
        const range = d.startDate === d.endDate
          ? formatDateHE(d.startDate)
          : `${formatDateHE(d.startDate)}–${formatDateHE(d.endDate)}`;
        return `${icon} ${range} (${countWorkingDays(d.startDate, d.endDate)} ימים)`;
      }).join('<br>')
    : `${formatDates(req.dates)} (${calcTotalDays(req.dates)} ימים)`;

  document.getElementById('detailInfo').innerHTML = `
    <strong>שם:</strong> ${escHtml(req.userName)}<br>
    <strong>תאריכים:</strong><br style="display:${reqDates.length > 1 ? 'inline' : 'none'}">${datesHtml}<br>
    <strong>סיבה:</strong> ${escHtml(req.reason || '—')}<br>
    ${req.activities ? `<strong>פעילות:</strong> ${escHtml(req.activities)}<br>` : ''}
    ${req.approvalNote ? `<strong>הערת הרכז:</strong> ${escHtml(req.approvalNote)}<br>` : ''}
    <strong>הוגש ב:</strong> ${new Date(req.createdAt).toLocaleDateString('he-IL')}
  `;
  document.getElementById('detailStatusWrap').innerHTML = statusBadge(req.status);

  // Period display: manager gets interactive per-row buttons; coordinator gets read-only status
  const partialSec   = document.getElementById('partialApprovalSection');
  const partialTitle = document.getElementById('partialSectionTitle');
  periodActions  = {};
  periodMessages = {};
  if (isManager && (isPending || isPartial)) {
    partialSec.style.display = 'block';
    partialTitle.textContent = '✔ בחר פעולה לכל תקופה:';
    buildDateRangeCheckboxes(reqDates, false);
  } else if (!isManager) {
    partialSec.style.display = 'block';
    partialTitle.textContent = '📋 סטטוס התקופות:';
    buildDateRangeCheckboxes(reqDates, true);
  } else {
    partialSec.style.display = 'none';
  }

  // Manager action bar (שגר button)
  const actDiv = document.getElementById('managerActions');
  actDiv.style.display = (isManager && (isPending || isPartial)) ? 'block' : 'none';
  document.getElementById('btnShagar').style.display = 'none';
  document.getElementById('managerMsgBox').style.display = 'none';
  if (isManager && (isPending || isPartial)) {
    document.getElementById('btnShagar').onclick = () => executeManagerAction(req);
  }
  updateShagarButton();

  // Coordinator reply / appeal box
  const replyBox = document.getElementById('replyBox');
  replyBox.style.display = (!isManager && (isPending || isPartial)) ? 'block' : 'none';
  const replyBtn = document.getElementById('btnSendReply');
  if (!isManager && isPartial) {
    document.getElementById('replyText').placeholder = 'כתוב את הערעור שלך על ההחלטה החלקית...';
    replyBtn.textContent = '⚖️ שלח ערעור';
  } else {
    document.getElementById('replyText').placeholder = 'כתוב תגובה...';
    replyBtn.textContent = 'שלח תגובה';
  }
  document.getElementById('managerMsgBox').style.display = 'none';

  // Real-time message listener — detach previous before attaching new
  db.ref(`vacationRequests/${currentRequestId}/messages`).off();
  listenToMessages(currentRequestId, msgs => renderMessages(msgs));

  // Wire buttons
  document.getElementById('btnPrint').onclick           = () => printRequest(req);
  document.getElementById('btnSendManagerMsg').onclick  = () => sendManagerMessage(req);
  document.getElementById('btnSendReply').onclick       = () => sendUserReply(req);

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

// ── Save textarea messages attached to period rows ──────────
async function saveRangeMessages(reqId, indices, dates) {
  for (const i of indices) {
    const input = document.querySelector(`#dateRangeCheckboxes input[data-msg-idx="${i}"]`);
    const msg   = input?.value?.trim();
    if (!msg) continue;
    const d     = dates[i];
    const label = d.startDate === d.endDate
      ? formatDateHE(d.startDate)
      : `${formatDateHE(d.startDate)} – ${formatDateHE(d.endDate)}`;
    const text  = dates.length > 1 ? `[${label}] ${msg}` : msg;
    await addMessage(reqId, {
      from: 'manager', senderName: currentProfile.name,
      text, timestamp: Date.now()
    });
  }
}

// ── Approve ────────────────────────────────────────────────
async function approveRequest(req) {
  showLoading(true);
  try {
    const dates   = normalizeDates(req.dates);
    const indices = [...document.querySelectorAll('#dateRangeCheckboxes input[type="checkbox"]:not([disabled])')]
      .map(cb => parseInt(cb.dataset.idx));

    await updateRequest(req.id, { status: 'approved', updatedAt: Date.now() });
    await saveRangeMessages(req.id, indices.length ? indices : dates.map((_, i) => i), dates);
    await notifyUserApproved({ ...req, status: 'approved' });

    const attendees = [
      { name: req.userName,    email: req.userWorkEmail    || req.userAuthEmail    },
      { name: req.managerName, email: req.managerWorkEmail || req.managerAuthEmail }
    ].filter(a => a.email);
    if (attendees.length) {
      for (const d of dates) {
        await sendCalendarInvite({
          toEmails:    attendees,
          summary:     `חופשה — ${req.userName}`,
          description: `חופשה מאושרת\nסיבה: ${req.reason || ''}`,
          startDate:   d.startDate,
          endDate:     d.endDate
        });
      }
    }

    closeModal('modalRequestDetail');
    showToast('✅ הבקשה אושרה!', 'success');
  } catch (err) {
    console.error('approveRequest error:', err);
    showToast('שגיאה באישור הבקשה: ' + err.message, 'error');
  } finally {
    showLoading(false);
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
//  PRINT
// ════════════════════════════════════════════════════════════
function printRequest(req) {
  const dates   = formatDates(normalizeDates(req.dates));
  const days    = calcTotalDays(req.dates);
  const created = new Date(req.createdAt).toLocaleDateString('he-IL');

  const statusLabel = { pending: 'ממתין לאישור', approved: 'מאושר', rejected: 'נדחה' }[req.status] || req.status;
  const statusColor = { pending: '#e67e22',        approved: '#1a7f4b', rejected: '#c0392b' }[req.status] || '#444';
  const statusBg    = { pending: '#fef3e2',        approved: '#e6f4ed', rejected: '#fdecea' }[req.status] || '#f5f5f5';

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>טופס בקשת חופש — ${escHtml(req.userName)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;direction:rtl;color:#222;background:#fff;padding:40px;font-size:14px}
    .header{text-align:center;border-bottom:3px solid #0056b3;padding-bottom:18px;margin-bottom:28px}
    .logo{font-size:38px;margin-bottom:6px}
    h1{color:#0056b3;font-size:22px;margin-bottom:4px}
    .subtitle{color:#666;font-size:12px}
    .section{margin-bottom:22px}
    .section-title{font-size:13px;font-weight:700;color:#0056b3;border-bottom:1px solid #dee2e6;padding-bottom:5px;margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px}
    .row{display:flex;gap:16px;margin-bottom:10px}
    .field{flex:1}
    .field label{font-size:11px;color:#666;font-weight:700;display:block;margin-bottom:3px}
    .value{border:1px solid #ccc;border-radius:4px;padding:8px 10px;min-height:36px;background:#fafafa;font-size:14px;line-height:1.5}
    .value.tall{min-height:60px}
    .days-value{text-align:center;font-size:22px;font-weight:700;color:#0056b3}
    .status-badge{display:inline-block;padding:6px 18px;border-radius:20px;font-weight:700;font-size:14px}
    .signatures{display:flex;gap:32px;margin-top:48px}
    .sig-box{flex:1;border-top:2px solid #333;padding-top:8px;text-align:center;font-size:12px;color:#555}
    .footer{text-align:center;margin-top:32px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:10px}
    @media print{body{padding:20px}@page{margin:1.5cm}}
  </style>
</head>
<body>

  <div class="header">
    <div class="logo">🏖️</div>
    <h1>טופס בקשת חופש</h1>
    <div class="subtitle">מערכת חופשות טכנודע &nbsp;|&nbsp; הוגש ב-${created}</div>
  </div>

  <div class="section">
    <div class="section-title">פרטי העובד/ת</div>
    <div class="row">
      <div class="field">
        <label>שם מלא</label>
        <div class="value">${escHtml(req.userName)}</div>
      </div>
      <div class="field">
        <label>מייל ארגוני</label>
        <div class="value">${escHtml(req.userWorkEmail || '—')}</div>
      </div>
    </div>
    <div class="row">
      <div class="field">
        <label>ממונה מאשר/ת</label>
        <div class="value">${escHtml(req.managerName || '—')}</div>
      </div>
      <div class="field">
        <label>תאריך הגשה</label>
        <div class="value">${created}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">פרטי החופשה</div>
    <div class="row">
      <div class="field">
        <label>תאריכי חופשה</label>
        <div class="value">${dates}</div>
      </div>
      <div class="field" style="max-width:110px">
        <label>סה"כ ימים</label>
        <div class="value days-value">${days}</div>
      </div>
    </div>
    <div class="field" style="margin-bottom:10px">
      <label>סיבת הבקשה</label>
      <div class="value tall">${escHtml(req.reason || '—')}</div>
    </div>
    ${req.activities ? `
    <div class="field">
      <label>פעילות אקדמית בתקופת ההיעדרות</label>
      <div class="value tall">${escHtml(req.activities)}</div>
    </div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">סטטוס הבקשה</div>
    <span class="status-badge" style="background:${statusBg};color:${statusColor}">${statusLabel}</span>
    ${req.rejectReason ? `<p style="margin-top:10px;font-size:13px;color:#c0392b">סיבת הדחייה: ${escHtml(req.rejectReason)}</p>` : ''}
  </div>

  <div class="signatures">
    <div class="sig-box">חתימת העובד/ת</div>
    <div class="sig-box">חתימת הממונה</div>
    <div class="sig-box">תאריך אישור</div>
  </div>

  <div class="footer">מערכת חופשות טכנודע &nbsp;|&nbsp; הופק אוטומטית</div>

  <script>
    window.onload = function() {
      window.print();
      window.addEventListener('afterprint', function() { window.close(); });
    };
  <\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
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

function dateToISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isHoliday(dateStr) {
  return HOLIDAYS.some(h => dateStr >= h.start && dateStr <= h.end);
}

function countWorkingDays(startStr, endStr) {
  let count = 0;
  const cur = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr   + 'T00:00:00');
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 6 && !(skipFriday && dow === 5) && !isHoliday(dateToISO(cur))) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function updateDaysCounter() {
  const container = document.getElementById('reqDatesContainer');
  const counter   = document.getElementById('reqDaysCounter');
  if (!container || !counter) return;
  let total = 0;
  container.querySelectorAll('.date-range-row').forEach(row => {
    const s = row.querySelector('.req-start-date')?.value;
    const e = row.querySelector('.req-end-date')?.value;
    if (s && e && e >= s) total += countWorkingDays(s, e);
  });
  counter.textContent   = total > 0 ? `סה"כ ${total} ימי חופשה` : '';
  counter.style.display = total > 0 ? 'block' : 'none';
}

function statusBadge(status) {
  return {
    pending:  `<span class="badge badge-pending">🟡 ממתין לאישור</span>`,
    approved: `<span class="badge badge-approved">🟢 מאושר</span>`,
    rejected: `<span class="badge badge-rejected">🔴 נדחה</span>`,
    partial:  `<span class="badge badge-partial">🔶 אושר חלקית</span>`
  }[status] || `<span class="badge">${status}</span>`;
}

function updateShagarButton() {
  const btn = document.getElementById('btnShagar');
  if (!btn) return;
  const hasAction = Object.values(periodActions).some(a => a === 'approve' || a === 'reject');
  btn.style.display = hasAction ? 'block' : 'none';
}

function setPeriodAction(idx, action) {
  if (action === null) delete periodActions[idx];
  else                 periodActions[idx] = action;
  buildDateRangeCheckboxes(currentReqDates, false);
  updateShagarButton();
}

function savePeriodMessage(idx, value) {
  periodMessages[idx] = value;
}

function executeManagerAction(req) {
  const toApprove = Object.entries(periodActions).filter(([,a]) => a === 'approve').map(([i]) => parseInt(i));
  const toReject  = Object.entries(periodActions).filter(([,a]) => a === 'reject').map(([i]) => parseInt(i));
  if (!toApprove.length && !toReject.length) return;
  submitMixedActions(req, toApprove, toReject);
}

async function submitMixedActions(req, toApprove, toReject) {
  showLoading(true);
  try {
    const dates        = normalizeDates(req.dates);
    const updatedDates = dates.map((d, i) => {
      const note = (periodMessages[i] || '').trim();
      if (toApprove.includes(i)) return { ...d, status: 'approved', ...(note ? { managerNote: note } : {}) };
      if (toReject.includes(i))  return { ...d, status: 'rejected', ...(note ? { managerNote: note } : {}) };
      return d;
    });

    const statuses  = updatedDates.map(d => d.status || 'pending');
    const newStatus = statuses.every(s => s === 'approved') ? 'approved'
                    : statuses.every(s => s === 'rejected') ? 'rejected'
                    : 'partial';

    // Combine rejected periods' notes as the request-level rejectReason
    const rejectNote = toReject.map(i => (periodMessages[i] || '').trim()).filter(Boolean).join(' | ');

    const updates = { dates: updatedDates, status: newStatus, updatedAt: Date.now() };
    if (rejectNote) updates.rejectReason = rejectNote;
    await updateRequest(req.id, updates);

    // Save per-period messages to the thread
    for (const i of [...toApprove, ...toReject]) {
      const msg = (periodMessages[i] || '').trim();
      if (!msg) continue;
      const d = updatedDates[i];
      const rangeLabel = d.startDate === d.endDate ? formatDateHE(d.startDate) : `${formatDateHE(d.startDate)} – ${formatDateHE(d.endDate)}`;
      const text = dates.length > 1 ? `[${rangeLabel}] ${msg}` : msg;
      await addMessage(req.id, { from: 'manager', senderName: currentProfile.name, text, timestamp: Date.now() });
    }

    if (toApprove.length) await notifyUserApproved({ ...req, dates: updatedDates, status: newStatus });
    if (toReject.length)  await notifyUserRejected(req, rejectNote);

    closeModal('modalRequestDetail');
    showToast(
      newStatus === 'approved' ? '✅ הבקשה אושרה!' :
      newStatus === 'rejected' ? 'הבקשה נדחתה' : '🔶 טופל חלקית',
      'success'
    );
  } catch (err) {
    console.error(err);
    showToast('שגיאה בעדכון הבקשה', 'error');
  }
  showLoading(false);
}

function buildDateRangeCheckboxes(dates, readOnly = false) {
  currentReqDates = dates;
  const container  = document.getElementById('dateRangeCheckboxes');
  const cancelBtn  = `style="border:none;background:#f0f0f0;color:#555;cursor:pointer;font-size:12px;padding:3px 8px;border-radius:4px;font-family:inherit;flex-shrink:0"`;
  const approveBtn = `style="border:2px solid #1a7f4b;color:#1a7f4b;background:#fff;font-weight:700;padding:4px 12px;border-radius:5px;cursor:pointer;font-family:inherit;font-size:12px;flex-shrink:0"`;
  const rejectBtn  = `style="border:2px solid #c0392b;color:#c0392b;background:#fff;font-weight:700;padding:4px 12px;border-radius:5px;cursor:pointer;font-family:inherit;font-size:12px;flex-shrink:0"`;
  const msgStyle   = `style="flex:1;min-width:80px;border:1px solid #ddd;border-radius:4px;padding:4px 8px;font-size:12px;font-family:inherit;color:#333"`;

  container.innerHTML = dates.map((d, i) => {
    const s          = d.status || 'pending';
    const dbApproved = s === 'approved';
    const dbRejected = s === 'rejected';
    const range = d.startDate === d.endDate
      ? formatDateHE(d.startDate)
      : `${formatDateHE(d.startDate)} – ${formatDateHE(d.endDate)}`;
    const days  = countWorkingDays(d.startDate, d.endDate);
    const label = `<span style="font-size:13px;white-space:nowrap;flex-shrink:0">${range} <span style="color:#888">(${days} ימים)</span></span>`;

    if (readOnly) {
      const [bc, bg, badge] = dbApproved
        ? ['#1a7f4b', '#e6f4ed', '<span style="color:#1a7f4b;font-size:12px;font-weight:700;flex-shrink:0">✅ מאושר</span>']
        : dbRejected
          ? ['#c0392b', '#fdecea', '<span style="color:#c0392b;font-size:12px;font-weight:700;flex-shrink:0">❌ נדחה</span>']
          : ['#dee2e6', '#fff',    '<span style="color:#e67e22;font-size:12px;font-weight:700;flex-shrink:0">🟡 ממתין</span>'];
      const noteHtml = d.managerNote
        ? `<span style="flex:1;font-size:12px;color:#555;font-style:italic">"${escHtml(d.managerNote)}"</span>`
        : '<span style="flex:1"></span>';
      return `<div style="border:1px solid ${bc};border-radius:6px;padding:9px 12px;background:${bg};display:flex;align-items:center;gap:10px;">${label}${noteHtml}${badge}</div>`;
    }

    // Manager interactive mode — message input persists via periodMessages
    const action  = periodActions[i];
    const msgVal  = escHtml(periodMessages[i] || '');
    const msgInput = `<input type="text" value="${msgVal}" oninput="savePeriodMessage(${i},this.value)" placeholder="צרף הודעה" ${msgStyle}>`;

    if (dbApproved) {
      return `<div style="border:1px solid #1a7f4b;border-radius:6px;padding:9px 12px;background:#e6f4ed;display:flex;align-items:center;gap:10px;">${label}<span style="color:#1a7f4b;font-size:12px;font-weight:700;margin-right:auto">✅ מאושר</span></div>`;
    }
    if (action === 'approve') {
      return `<div style="border:1px solid #1a7f4b;border-radius:6px;padding:9px 12px;background:#e6f4ed;display:flex;align-items:center;gap:10px;">${label}${msgInput}<span style="color:#1a7f4b;font-size:13px;font-weight:700;white-space:nowrap;flex-shrink:0">✅ מאושר</span><button onclick="setPeriodAction(${i},null)" ${cancelBtn}>✕ בטל</button></div>`;
    }
    if (action === 'reject') {
      return `<div style="border:1px solid #c0392b;border-radius:6px;padding:9px 12px;background:#fdecea;display:flex;align-items:center;gap:10px;">${label}${msgInput}<span style="color:#c0392b;font-size:13px;font-weight:700;white-space:nowrap;flex-shrink:0">❌ נדחה</span><button onclick="setPeriodAction(${i},null)" ${cancelBtn}>✕ בטל</button></div>`;
    }
    // No action yet
    return `<div style="border:1px solid #dee2e6;border-radius:6px;padding:9px 12px;background:#fff;display:flex;align-items:center;gap:10px;">${label}${msgInput}<div style="display:flex;gap:6px;flex-shrink:0;"><button onclick="setPeriodAction(${i},'approve')" ${approveBtn}>✅ אשר</button><button onclick="setPeriodAction(${i},'reject')" ${rejectBtn}>❌ דחה</button></div></div>`;
  }).join('');
}

async function partialApprove(req) {
  const unchecked = [...document.querySelectorAll('#dateRangeCheckboxes input[type="checkbox"]:not([disabled])')];
  const selected  = unchecked.filter(cb => cb.checked).map(cb => parseInt(cb.dataset.idx));
  if (!selected.length) { showToast('יש לבחור לפחות תקופה אחת', 'error'); return; }

  showLoading(true);
  try {
    const dates        = normalizeDates(req.dates);
    const updatedDates = dates.map((d, i) => ({
      ...d,
      status: selected.includes(i) ? 'approved' : (d.status || 'pending')
    }));

    const allApproved  = updatedDates.every(d => d.status === 'approved');
    const newStatus    = allApproved ? 'approved' : 'partial';

    await updateRequest(req.id, { dates: updatedDates, status: newStatus, updatedAt: Date.now() });

    // זימון רק לתקופות שנבחרו עכשיו (לא כאלה שכבר היו מאושרות)
    const prevApproved = new Set(dates.map((d, i) => d.status === 'approved' ? i : -1));
    const attendees    = [
      { name: req.userName,    email: req.userWorkEmail    || req.userAuthEmail    },
      { name: req.managerName, email: req.managerWorkEmail || req.managerAuthEmail }
    ].filter(a => a.email);

    for (const i of selected) {
      if (prevApproved.has(i)) continue; // כבר נשלח זימון
      const range = updatedDates[i];
      await sendCalendarInvite({
        toEmails:    attendees,
        summary:     `חופשה — ${req.userName}`,
        description: `חופשה מאושרת\nסיבה: ${req.reason || ''}`,
        startDate:   range.startDate,
        endDate:     range.endDate
      });
    }

    // מייל לרכז
    const newlyApproved = selected.map(i => updatedDates[i]).filter((_, i) => !prevApproved.has(selected[i]));
    if (newStatus === 'approved') {
      await notifyUserApproved({ ...req, dates: updatedDates, status: 'approved' });
    } else {
      await notifyUserPartialApproval({ ...req, approvedDates: newlyApproved });
    }

    await saveRangeMessages(req.id, selected, normalizeDates(req.dates));

    closeModal('modalRequestDetail');
    showToast(newStatus === 'approved' ? '✅ הבקשה אושרה!' : '🔶 אושר חלקית', 'success');
  } catch (err) {
    console.error(err);
    showToast('שגיאה באישור', 'error');
  }
  showLoading(false);
}

function calcTotalDays(dates) {
  return normalizeDates(dates).reduce((sum, d) => {
    if (!d.startDate || !d.endDate || d.endDate < d.startDate) return sum;
    return sum + countWorkingDays(d.startDate, d.endDate);
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
