// ============================================================
// DASHBOARD.JS — Vacation Management Dashboard
// ============================================================

let dashUser    = null;
let allRequests = [];
let allWorkers  = [];
let calYear, calMonth;
let dashLogoutTimer = null;

const HE_MONTHS_FULL = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                        'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const HE_DAYS_SHORT  = ['א','ב','ג','ד','ה','ו','ש']; // Sun–Sat

const COLOR_PALETTE = [
  { bg: '#dbeafe', text: '#1e40af' },
  { bg: '#dcfce7', text: '#166534' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#ede9fe', text: '#5b21b6' },
  { bg: '#ffedd5', text: '#9a3412' },
  { bg: '#d1fae5', text: '#065f46' },
  { bg: '#e0e7ff', text: '#3730a3' },
  { bg: '#fef9c3', text: '#854d0e' },
  { bg: '#fee2e2', text: '#991b1b' },
  { bg: '#f0fdf4', text: '#14532d' },
];
const employeeColorMap = {};
function getColor(name) {
  if (!employeeColorMap[name]) {
    const idx = Object.keys(employeeColorMap).length % COLOR_PALETTE.length;
    employeeColorMap[name] = COLOR_PALETTE[idx];
  }
  return employeeColorMap[name];
}

// ── Init ───────────────────────────────────────────────────
window.addEventListener('load', () => {
  firebase.initializeApp(FIREBASE_CONFIG);
  const auth = firebase.auth();
  initDB(firebase.database());

  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();

  auth.onAuthStateChanged(async user => {
    if (user) {
      if (dashLogoutTimer) { clearTimeout(dashLogoutTimer); dashLogoutTimer = null; }
      if (dashUser && dashUser.uid === user.uid) return;

      if (!DASHBOARD_EMAILS.includes(user.email.toLowerCase())) {
        await auth.signOut();
        document.getElementById('dashError').style.display = 'block';
        return;
      }
      dashUser = user;
      document.getElementById('dashUserName').textContent = user.displayName || user.email;
      showView('dashView');
      await loadAllData();
    } else {
      if (dashLogoutTimer) clearTimeout(dashLogoutTimer);
      dashLogoutTimer = setTimeout(() => {
        if (!firebase.auth().currentUser) {
          dashUser = null;
          showView('loginView');
        }
        dashLogoutTimer = null;
      }, 4000);
    }
  });

  document.getElementById('btnDashLogin').addEventListener('click', () => {
    document.getElementById('dashError').style.display = 'none';
    firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())
      .catch(err => showToast('שגיאה בכניסה: ' + err.message, 'error'));
  });

  document.getElementById('btnDashLogout').addEventListener('click', () =>
    firebase.auth().signOut()
  );

  document.getElementById('btnRefresh').addEventListener('click', loadAllData);

  // View toggle
  document.getElementById('btnDashCal').addEventListener('click', () => {
    setView('calendar');
    renderCalendar();
  });
  document.getElementById('btnDashTable').addEventListener('click', () => {
    setView('table');
    renderTable();
  });
  document.getElementById('btnDashReport').addEventListener('click', () => {
    setView('report');
    populateReportMonthPicker();
  });

  // Calendar navigation
  document.getElementById('calPrev').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });

  // Filters
  document.getElementById('filterName').addEventListener('input', onFilter);
  document.getElementById('filterMonth').addEventListener('change', onFilter);
  document.getElementById('filterStatus').addEventListener('change', onFilter);

  // Report — by month
  document.getElementById('btnExportReport').addEventListener('click', exportReport);
  document.getElementById('btnPrintReport2').addEventListener('click', printReport);
  document.getElementById('btnNewWindowReport2').addEventListener('click', openReportWindow);

  // Report — sub-toggle
  document.getElementById('btnReportByMonth').addEventListener('click', () => setReportMode('month'));
  document.getElementById('btnReportByEmp').addEventListener('click',   () => setReportMode('emp'));

  // Report — by employee
  document.getElementById('btnExportEmpReport').addEventListener('click', exportEmpReport);
  document.getElementById('btnPrintEmpReport').addEventListener('click', printEmpReport);
  document.getElementById('btnNewWindowEmpReport').addEventListener('click', openEmpReportWindow);

  // Day modal close
  document.getElementById('btnCloseDayModal').addEventListener('click', () =>
    document.getElementById('modalDay').classList.remove('open')
  );
  document.getElementById('modalDay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalDay'))
      document.getElementById('modalDay').classList.remove('open');
  });
});

// ── Load Data ──────────────────────────────────────────────
async function loadAllData() {
  showLoading(true);
  try {
    const [reqSnap, wrkSnap] = await Promise.all([
      firebase.database().ref('vacationRequests').once('value'),
      firebase.database().ref('workers').once('value')
    ]);
    allRequests = reqSnap.val() ? Object.values(reqSnap.val()) : [];
    allWorkers  = wrkSnap.val() ? Object.values(wrkSnap.val()) : [];

    populateMonthFilter();
    renderCalendar();
    if (document.getElementById('sectionTable').classList.contains('active')) renderTable();
  } catch (err) {
    showToast('שגיאה בטעינת נתונים: ' + err.message, 'error');
  }
  showLoading(false);
}

function populateMonthFilter() {
  const months = new Set();
  allRequests.forEach(r => {
    normDates(r.dates).forEach(d => {
      months.add(d.startDate.substring(0, 7));
    });
  });
  const sel = document.getElementById('filterMonth');
  const current = sel.value;
  sel.innerHTML = '<option value="">כל החודשים</option>';
  [...months].sort().reverse().forEach(m => {
    const [y, mo] = m.split('-');
    const label = `${HE_MONTHS_FULL[parseInt(mo) - 1]} ${y}`;
    sel.innerHTML += `<option value="${m}" ${m === current ? 'selected' : ''}>${label}</option>`;
  });
}

// ── View toggle ────────────────────────────────────────────
function setView(mode) {
  document.getElementById('sectionCalendar').classList.toggle('active', mode === 'calendar');
  document.getElementById('sectionTable').classList.toggle('active', mode === 'table');
  document.getElementById('sectionReport').classList.toggle('active', mode === 'report');
  document.getElementById('btnDashCal').classList.toggle('active', mode === 'calendar');
  document.getElementById('btnDashTable').classList.toggle('active', mode === 'table');
  document.getElementById('btnDashReport').classList.toggle('active', mode === 'report');
  // filters only relevant for cal/table
  const showFilters = mode !== 'report';
  ['filterName','filterMonth','filterStatus'].forEach(id =>
    document.getElementById(id).style.display = showFilters ? '' : 'none'
  );
}

function onFilter() {
  const isTable = document.getElementById('sectionTable').classList.contains('active');
  if (isTable) renderTable(); else renderCalendar();
}

// ── Calendar ────────────────────────────────────────────────
function renderCalendar() {
  const label = `${HE_MONTHS_FULL[calMonth]} ${calYear}`;
  document.getElementById('calLabel').textContent = label;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  // Day headers (Sun=0 … Sat=6 in RTL order: א ב ג ד ה ו ש)
  HE_DAYS_SHORT.forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-day-header';
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayStr = toDateStr(new Date());

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement('div');
    e.className = 'cal-day empty';
    grid.appendChild(e);
  }

  const nameFilter = document.getElementById('filterName').value.trim().toLowerCase();
  const statusFilter = document.getElementById('filterStatus').value;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${calYear}-${pad(calMonth + 1)}-${pad(day)}`;
    const dow = new Date(calYear, calMonth, day).getDay();
    const isWeekend = dow === 5 || dow === 6;
    const isToday = dateStr === todayStr;

    const vacations = getVacationsOnDay(dateStr, nameFilter, statusFilter);

    const cell = document.createElement('div');
    cell.className = `cal-day${isWeekend ? ' weekend' : ''}${isToday ? ' today' : ''}`;

    const numEl = document.createElement('span');
    numEl.className = 'cal-day-num';
    numEl.textContent = day;
    cell.appendChild(numEl);

    const show = vacations.slice(0, 3);
    const more = vacations.length - show.length;

    show.forEach(v => {
      const color = getColor(v.userName);
      const badge = document.createElement('span');
      badge.className = 'cal-badge';
      badge.style.background = color.bg;
      badge.style.color = color.text;
      badge.textContent = v.userName;
      badge.title = `${v.userName} — ${fmtStatus(v.status)}`;
      badge.addEventListener('click', () => openDayModal(dateStr, nameFilter, statusFilter));
      cell.appendChild(badge);
    });

    if (more > 0) {
      const moreEl = document.createElement('span');
      moreEl.className = 'cal-more';
      moreEl.textContent = `+${more} נוספים`;
      moreEl.addEventListener('click', () => openDayModal(dateStr, nameFilter, statusFilter));
      cell.appendChild(moreEl);
    }

    if (vacations.length > 0) {
      cell.addEventListener('click', e => {
        if (e.target === cell || e.target === numEl)
          openDayModal(dateStr, nameFilter, statusFilter);
      });
    }

    grid.appendChild(cell);
  }
}

function getVacationsOnDay(dateStr, nameFilter = '', statusFilter = '') {
  const results = [];
  allRequests.forEach(r => {
    if (statusFilter && r.status !== statusFilter) return;
    if (nameFilter && !(r.userName || '').toLowerCase().includes(nameFilter)) return;
    const dates = normDates(r.dates);
    const hits = dates.filter(d => d.startDate <= dateStr && d.endDate >= dateStr);
    if (hits.length) results.push(r);
  });
  results.sort((a, b) => (a.userName || '').localeCompare(b.userName || '', 'he'));
  return results;
}

function openDayModal(dateStr, nameFilter, statusFilter) {
  const [y, m, d] = dateStr.split('-');
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  const HE_DAYS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  document.getElementById('modalDayTitle').textContent =
    `${d}/${m}/${y} — יום ${HE_DAYS[dow]}`;

  const vacations = getVacationsOnDay(dateStr, nameFilter, statusFilter);
  const list = document.getElementById('modalDayList');
  list.innerHTML = vacations.length ? vacations.map(v => {
    const color = getColor(v.userName);
    const dates = normDates(v.dates);
    const range = dates.find(d => d.startDate <= dateStr && d.endDate >= dateStr);
    const rangeStr = range
      ? (range.startDate === range.endDate ? fmtDate(range.startDate) : `${fmtDate(range.startDate)} – ${fmtDate(range.endDate)}`)
      : '';
    return `<li>
      <span class="day-modal-dot" style="background:${color.bg};border:2px solid ${color.text}"></span>
      <div>
        <strong>${escHtml(v.userName)}</strong><br>
        <span style="font-size:12px;color:#666">${rangeStr} &nbsp;|&nbsp; ${fmtStatus(v.status)}</span><br>
        <span style="font-size:12px;color:#888">${escHtml(v.reason || '—')}</span>
      </div>
    </li>`;
  }).join('') : '<li style="color:#aaa;padding:16px 0">אין חופשות ביום זה</li>';

  document.getElementById('modalDay').classList.add('open');
}

// ── Table ──────────────────────────────────────────────────
function renderTable() {
  const nameFilter   = document.getElementById('filterName').value.trim().toLowerCase();
  const monthFilter  = document.getElementById('filterMonth').value;
  const statusFilter = document.getElementById('filterStatus').value;

  // Build flat list of (request, date-range) pairs filtered to selected criteria
  const rows = [];
  allRequests.forEach(r => {
    if (statusFilter && r.status !== statusFilter) return;
    if (nameFilter && !(r.userName || '').toLowerCase().includes(nameFilter)) return;

    normDates(r.dates).forEach(d => {
      const monthStr = d.startDate.substring(0, 7);
      if (monthFilter && monthStr !== monthFilter) return;
      rows.push({ r, d, monthStr });
    });
  });

  // Sort by start date desc
  rows.sort((a, b) => b.d.startDate.localeCompare(a.d.startDate));

  const wrap = document.getElementById('tableWrap');

  if (!rows.length) {
    wrap.innerHTML = `<div class="no-results">📭 אין נתונים התואמים את הסינון</div>`;
    return;
  }

  // Group by month
  const byMonth = {};
  rows.forEach(item => {
    if (!byMonth[item.monthStr]) byMonth[item.monthStr] = [];
    byMonth[item.monthStr].push(item);
  });

  const sortedMonths = Object.keys(byMonth).sort().reverse();

  wrap.innerHTML = sortedMonths.map(monthStr => {
    const [y, mo] = monthStr.split('-');
    const monthLabel = `${HE_MONTHS_FULL[parseInt(mo) - 1]} ${y}`;
    const monthRows  = byMonth[monthStr];

    const totalDays = monthRows.reduce((s, { d }) => s + countWorkDays(d.startDate, d.endDate), 0);
    const uniqueNames = new Set(monthRows.map(x => x.r.userName)).size;

    const tableRows = monthRows.map(({ r, d }) => {
      const days      = countWorkDays(d.startDate, d.endDate);
      const rangeStr  = d.startDate === d.endDate ? fmtDate(d.startDate) : `${fmtDate(d.startDate)} – ${fmtDate(d.endDate)}`;
      const worker    = allWorkers.find(w => w.name === r.userName);
      const dept      = worker?.department || '—';
      const color     = getColor(r.userName);

      return `<tr>
        <td>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color.bg};border:2px solid ${color.text};margin-left:6px"></span>
          <strong>${escHtml(r.userName)}</strong>
        </td>
        <td style="font-size:13px;color:#666">${escHtml(dept)}</td>
        <td style="direction:ltr;text-align:right;font-size:13px">${rangeStr}</td>
        <td style="text-align:center;font-weight:700;color:#0056b3">${days}</td>
        <td style="font-size:13px;color:#555;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.reason || '')}">${escHtml(r.reason || '—')}</td>
        <td><span class="status-badge status-${r.status}">${fmtStatus(r.status)}</span></td>
      </tr>`;
    }).join('');

    return `
      <div class="month-group-header">
        <span>${monthLabel}</span>
        <span class="month-stats">${uniqueNames} עובדים · ${totalDays} ימי חופש</span>
      </div>
      <table class="data-table" style="border-radius:0 0 8px 8px;margin-bottom:0">
        <thead>
          <tr>
            <th>שם עובד/ת</th>
            <th>מחלקה</th>
            <th>תאריכים</th>
            <th style="text-align:center">ימים</th>
            <th>סיבה</th>
            <th>סטטוס</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>`;
  }).join('');
}

// ── Helpers ────────────────────────────────────────────────
function normDates(dates) {
  if (!dates) return [];
  if (Array.isArray(dates)) return dates;
  return Object.values(dates);
}

function toDateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function fmtDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function fmtStatus(s) {
  return { approved: 'מאושר', partial: 'מאושר חלקית', pending: 'ממתין', rejected: 'נדחה' }[s] || s;
}

function countWorkDays(start, end) {
  let count = 0;
  const cur = new Date(start + 'T00:00:00');
  const fin = new Date(end   + 'T00:00:00');
  while (cur <= fin) {
    const dow = cur.getDay();
    if (dow !== 5 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Monthly Report ─────────────────────────────────────────
let lastReportHtml = '';

function populateReportMonthPicker() {
  const months = new Set();
  allRequests.forEach(r => {
    normDates(r.dates).forEach(d => months.add(d.startDate.substring(0, 7)));
  });
  const sel = document.getElementById('reportMonthPicker');
  const current = sel.value;
  sel.innerHTML = [...months].sort().reverse().map(m => {
    const [y, mo] = m.split('-');
    return `<option value="${m}" ${m === current ? 'selected' : ''}>${HE_MONTHS_FULL[parseInt(mo)-1]} ${y}</option>`;
  }).join('');

  // Reset preview
  document.getElementById('reportPreviewWrap').style.display = 'none';
  document.getElementById('reportEmpty').style.display = 'none';
  lastReportHtml = '';
}

function exportReport() {
  const monthStr = document.getElementById('reportMonthPicker').value;
  if (!monthStr) return;

  const [year, month] = monthStr.split('-').map(Number);
  const firstDay   = `${monthStr}-01`;
  const lastDayNum = new Date(year, month, 0).getDate();
  const lastDay    = `${monthStr}-${pad(lastDayNum)}`;
  const monthLabel = `${HE_MONTHS_FULL[month - 1]} ${year}`;

  const relevant = allRequests.filter(r => {
    if (!['approved', 'partial'].includes(r.status)) return false;
    return normDates(r.dates).some(d => d.startDate <= lastDay && d.endDate >= firstDay);
  });

  document.getElementById('reportPreviewWrap').style.display = 'none';
  document.getElementById('reportEmpty').style.display = 'none';

  if (!relevant.length) {
    document.getElementById('reportEmpty').style.display = 'block';
    return;
  }

  // Group by employee
  const byUser = {};
  relevant.forEach(r => {
    const uid = r.userId || r.userName;
    if (!byUser[uid]) byUser[uid] = { name: r.userName, uid: r.userId, requests: [] };
    byUser[uid].requests.push(r);
  });
  const sorted = Object.values(byUser).sort((a, b) => a.name.localeCompare(b.name, 'he'));

  lastReportHtml = buildMonthReportHtml(sorted, monthLabel, monthStr, firstDay, lastDay);
  document.getElementById('reportPreviewBody').innerHTML = lastReportHtml;
  document.getElementById('reportPreviewWrap').style.display = 'block';
}

function buildMonthReportHtml(sorted, monthLabel, monthStr, firstDay, lastDay) {
  const sysUrl         = typeof SYSTEM_URL !== 'undefined' ? SYSTEM_URL : 'https://snirsnir.github.io/vacation/';
  const totalEmployees = sorted.length;
  const totalAllDays   = sorted.reduce((s, e) => s + repCalcDays(e.requests, firstDay, lastDay), 0);

  const rows = sorted.map(emp => {
    const url  = `${sysUrl}report.html?uid=${encodeURIComponent(emp.uid)}&month=${monthStr}`;
    const days = repCalcDays(emp.requests, firstDay, lastDay);
    return `<tr>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;font-size:15px;font-weight:600">
        <a href="${url}" style="color:#0056b3;text-decoration:none" target="_blank">${emp.name}</a>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;font-size:14px;color:#555;text-align:center">
        ${emp.requests.length} בקשות
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;font-size:14px;font-weight:700;color:#0056b3;text-align:center">
        ${days} ימים
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;text-align:center">
        <a href="${url}" target="_blank"
           style="display:inline-block;background:#0056b3;color:#fff;padding:6px 16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:700">
          דוח + הדפסה
        </a>
      </td>
    </tr>`;
  }).join('');

  return `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;direction:rtl;background:#eef2f7;padding:28px 16px;margin:0">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,86,0.10)">
    <div style="background:linear-gradient(135deg,#0056b3 0%,#0077e6 100%);padding:28px 36px;color:#fff;text-align:right">
      <div style="font-size:13px;font-weight:600;opacity:0.8;margin-bottom:6px;letter-spacing:1px;text-transform:uppercase">TECHNODA</div>
      <div style="font-size:22px;font-weight:700;margin-bottom:4px">דוח חופשות חודשי &mdash; ${monthLabel}</div>
      <div style="font-size:14px;opacity:0.85">מערכת חופשות טכנודע</div>
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
      מערכת חופשות טכנודע &nbsp;|&nbsp; ${monthLabel}
    </div>
  </div>
</div>`;
}

function repCalcDays(requests, firstDay, lastDay) {
  let total = 0;
  requests.forEach(r => {
    normDates(r.dates).forEach(d => {
      if (!d.startDate || !d.endDate || d.startDate > lastDay || d.endDate < firstDay) return;
      const start = d.startDate < firstDay ? firstDay : d.startDate;
      const end   = d.endDate   > lastDay  ? lastDay  : d.endDate;
      total += countWorkDays(start, end);
    });
  });
  return total;
}

// ── Report mode toggle ────────────────────────────────────
function setReportMode(mode) {
  document.getElementById('reportSubMonth').style.display = mode === 'month' ? '' : 'none';
  document.getElementById('reportSubEmp').style.display   = mode === 'emp'   ? '' : 'none';
  document.getElementById('btnReportByMonth').classList.toggle('active', mode === 'month');
  document.getElementById('btnReportByEmp').classList.toggle('active',   mode === 'emp');
  if (mode === 'emp') populateEmpPicker();
}

// ── By-Employee report ─────────────────────────────────────
let allEmpNames = [];
let lastEmpReportHtml = '';

function populateEmpPicker() {
  const nameSet = new Set();
  allRequests.forEach(r => { if (r.userName) nameSet.add(r.userName); });
  allEmpNames = [...nameSet].sort((a, b) => a.localeCompare(b, 'he'));
  buildEmpPickerOptions(allEmpNames);
}

function buildEmpPickerOptions(names) {
  const sel = document.getElementById('reportEmpPicker');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— בחר עובד/ת —</option>' +
    names.map(n => `<option value="${escHtml(n)}" ${n === cur ? 'selected' : ''}>${escHtml(n)}</option>`).join('');
}

function exportEmpReport() {
  const empName = document.getElementById('reportEmpPicker').value;
  if (!empName) { showToast('יש לבחור עובד/ת', 'error'); return; }

  const empRequests = allRequests.filter(r =>
    r.userName === empName && ['approved', 'partial', 'pending', 'rejected'].includes(r.status)
  );

  document.getElementById('empPreviewWrap').style.display = 'none';
  document.getElementById('empReportEmpty').style.display = 'none';

  if (!empRequests.length) {
    document.getElementById('empReportEmpty').style.display = 'block';
    return;
  }

  const worker = allWorkers.find(w => w.name === empName);
  lastEmpReportHtml = buildEmpReportHtml(empName, worker, empRequests);
  document.getElementById('empPreviewBody').innerHTML = lastEmpReportHtml;
  document.getElementById('empPreviewWrap').style.display = 'block';
}

function buildEmpReportHtml(empName, worker, requests) {
  const dept      = worker?.department || '';
  const sysUrl    = typeof SYSTEM_URL !== 'undefined' ? SYSTEM_URL : 'https://snirsnir.github.io/vacation/';
  const uid       = requests[0]?.userId || '';

  const approved  = requests.filter(r => ['approved','partial'].includes(r.status));
  const totalDays = approved.reduce((s, r) => s + normDates(r.dates).reduce((ss, d) =>
    ss + countWorkDays(d.startDate, d.endDate), 0), 0);

  // Sort by most recent first
  const sorted = [...requests].sort((a, b) =>
    (normDates(b.dates)[0]?.startDate || '').localeCompare(normDates(a.dates)[0]?.startDate || '')
  );

  const STATUS_LABEL = { approved: 'מאושר', partial: 'מאושר חלקית', pending: 'ממתין', rejected: 'נדחה' };
  const STATUS_COLOR = { approved: '#d4edda;color:#155724', partial: '#fff3cd;color:#856404', pending: '#e2e3e5;color:#383d41', rejected: '#f8d7da;color:#721c24' };

  const rows = sorted.map(r => {
    const dates   = normDates(r.dates);
    const rangeStr = dates.map(d =>
      d.startDate === d.endDate ? fmtDate(d.startDate) : `${fmtDate(d.startDate)} – ${fmtDate(d.endDate)}`
    ).join('<br>');
    const days = dates.reduce((s, d) => s + countWorkDays(d.startDate, d.endDate), 0);
    const col  = STATUS_COLOR[r.status] || '#eee;color:#333';
    return `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:13px;direction:ltr;text-align:right">${rangeStr}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:#0056b3">${days}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:13px">${escHtml(r.reason || '—')}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:center">
        <span style="background:${col};padding:3px 10px;border-radius:10px;font-size:12px;font-weight:700">${STATUS_LABEL[r.status] || r.status}</span>
      </td>
    </tr>`;
  }).join('');

  const reportLink = uid ? `${sysUrl}report.html?uid=${encodeURIComponent(uid)}` : '';

  return `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;direction:rtl;background:#eef2f7;padding:28px 16px;margin:0">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,86,0.10)">
    <div style="background:linear-gradient(135deg,#0056b3 0%,#0077e6 100%);padding:28px 36px;color:#fff;text-align:right">
      <div style="font-size:13px;font-weight:600;opacity:0.8;margin-bottom:6px;letter-spacing:1px;text-transform:uppercase">TECHNODA</div>
      <div style="font-size:22px;font-weight:700;margin-bottom:4px">דוח חופשות — ${escHtml(empName)}</div>
      ${dept ? `<div style="font-size:14px;opacity:0.85">מחלקה: ${escHtml(dept)}</div>` : ''}
    </div>
    <div style="display:flex;gap:0;border-bottom:1px solid #eee">
      <div style="flex:1;padding:20px 24px;text-align:center;border-left:1px solid #eee">
        <div style="font-size:28px;font-weight:700;color:#0056b3">${approved.length}</div>
        <div style="font-size:13px;color:#888;margin-top:4px">בקשות מאושרות</div>
      </div>
      <div style="flex:1;padding:20px 24px;text-align:center;border-left:1px solid #eee">
        <div style="font-size:28px;font-weight:700;color:#1a7f4b">${totalDays}</div>
        <div style="font-size:13px;color:#888;margin-top:4px">ימי חופש מאושרים</div>
      </div>
      <div style="flex:1;padding:20px 24px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:#555">${requests.length}</div>
        <div style="font-size:13px;color:#888;margin-top:4px">סה"כ בקשות</div>
      </div>
    </div>
    <div style="padding:24px 28px">
      <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#f4f6fa">
            <th style="padding:11px 14px;text-align:right;font-size:13px;color:#555;font-weight:700">תאריכים</th>
            <th style="padding:11px 14px;text-align:center;font-size:13px;color:#555;font-weight:700">ימים</th>
            <th style="padding:11px 14px;text-align:right;font-size:13px;color:#555;font-weight:700">סיבה</th>
            <th style="padding:11px 14px;text-align:center;font-size:13px;color:#555;font-weight:700">סטטוס</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${reportLink ? `<div style="text-align:center;margin-top:20px">
        <a href="${reportLink}" target="_blank"
           style="display:inline-block;background:#0056b3;color:#fff;padding:10px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
          דוח מפורט + הדפסה
        </a>
      </div>` : ''}
    </div>
    <div style="background:#f4f6fa;padding:14px 28px;text-align:center;font-size:12px;color:#bbb;border-top:1px solid #eee">
      מערכת חופשות טכנודע &nbsp;|&nbsp; ${escHtml(empName)}
    </div>
  </div>
</div>`;
}

function printEmpReport() {
  if (!lastEmpReportHtml) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <title>דוח עובד</title><style>body{margin:0} @media print{@page{margin:10mm}}</style>
  </head><body>${lastEmpReportHtml}
    <script>window.onload=function(){window.print();}<\/script>
  </body></html>`);
  win.document.close();
}

function openEmpReportWindow() {
  if (!lastEmpReportHtml) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <title>דוח עובד</title><style>body{margin:0} @media print{@page{margin:10mm} .no-print{display:none}}</style>
  </head><body>
    <div class="no-print" style="background:#0056b3;color:#fff;padding:12px 24px;display:flex;gap:12px;align-items:center;direction:rtl">
      <strong>דוח עובד</strong>
      <button onclick="window.print()" style="background:#fff;color:#0056b3;border:none;padding:6px 16px;border-radius:6px;font-weight:700;cursor:pointer">🖨️ הדפסה / שמור PDF</button>
    </div>
    ${lastEmpReportHtml}
  </body></html>`);
  win.document.close();
}

function printReport() {
  if (!lastReportHtml) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <title>דוח חופשות</title>
    <style>body{margin:0;padding:0} @media print{@page{margin:10mm}}</style>
  </head><body>${lastReportHtml}
    <script>window.onload=function(){window.print();}<\/script>
  </body></html>`);
  win.document.close();
}

function openReportWindow() {
  if (!lastReportHtml) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <title>דוח חופשות</title>
    <style>body{margin:0;padding:0} @media print{@page{margin:10mm} .no-print{display:none}}</style>
  </head><body>
    <div class="no-print" style="background:#0056b3;color:#fff;padding:12px 24px;display:flex;gap:12px;align-items:center;direction:rtl">
      <strong>דוח חופשות</strong>
      <button onclick="window.print()" style="background:#fff;color:#0056b3;border:none;padding:6px 16px;border-radius:6px;font-weight:700;cursor:pointer">🖨️ הדפסה / שמור PDF</button>
    </div>
    ${lastReportHtml}
  </body></html>`);
  win.document.close();
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
