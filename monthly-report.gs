// ============================================================
// MONTHLY VACATION REPORT — Google Apps Script
// ============================================================
// הוראות התקנה:
// 1. כנס ל: script.google.com
// 2. צור פרויקט חדש (New Project)
// 3. הדבק את הקוד הזה
// 4. שמור
// 5. הגדר Trigger: Triggers → Add Trigger:
//    Function: sendMonthlyReport
//    Event: Time-driven → Month timer → Day of month: 28
// 6. אשר הרשאות Gmail
// ============================================================

const FIREBASE_DB_URL = 'https://vacation-788ea-default-rtdb.europe-west1.firebasedatabase.app';
const REPORT_EMAILS   = 'shuli@technoda.org.il,ronit@technoda.org.il';
const SYSTEM_URL      = 'https://snirsnir.github.io/vacation/';

// ── Main function (runs on the 28th) ─────────────────────
function sendMonthlyReport() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                     'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const monthLabel = `${HE_MONTHS[month - 1]} ${year}`;

  // ── Fetch all vacation requests from Firebase REST API ──
  const url  = `${FIREBASE_DB_URL}/vacationRequests.json`;
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

  if (resp.getResponseCode() !== 200) {
    Logger.log('שגיאה בשליפת נתוני Firebase: ' + resp.getContentText());
    return;
  }

  const data = JSON.parse(resp.getContentText());
  if (!data) {
    Logger.log('אין נתונים ב-Firebase');
    return;
  }

  // ── Filter requests that overlap with this month ────────
  const firstDay   = `${monthStr}-01`;
  const lastDayNum = new Date(year, month, 0).getDate();
  const lastDay    = `${monthStr}-${String(lastDayNum).padStart(2, '0')}`;

  const allRequests = Object.values(data);
  const relevant = allRequests.filter(r => {
    if (!['approved', 'partial'].includes(r.status)) return false;
    const dates = normalizeDates(r.dates);
    return dates.some(d => d.startDate <= lastDay && d.endDate >= firstDay);
  });

  if (!relevant.length) {
    Logger.log(`אין חופשות מאושרות ל-${monthLabel}`);
    return;
  }

  // ── Group by employee (userId) ──────────────────────────
  const byUser = {};
  relevant.forEach(r => {
    const uid = r.userId || r.userName;
    if (!byUser[uid]) byUser[uid] = { name: r.userName, uid: r.userId, requests: [] };
    byUser[uid].requests.push(r);
  });

  // ── Sort alphabetically by name (Hebrew) ───────────────
  const sorted = Object.values(byUser).sort((a, b) =>
    a.name.localeCompare(b.name, 'he')
  );

  // ── Build email HTML ────────────────────────────────────
  const employeeRows = sorted.map(emp => {
    const reportUrl = `${SYSTEM_URL}report.html?uid=${encodeURIComponent(emp.uid)}&month=${monthStr}`;
    const totalDays = calcTotalDays(emp.requests, firstDay, lastDay);
    return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #eee;font-size:15px;font-weight:600">
          <a href="${reportUrl}"
             style="color:#0056b3;text-decoration:none">${emp.name}</a>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #eee;font-size:14px;color:#555;text-align:center">
          ${emp.requests.length} בקשות
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #eee;font-size:14px;font-weight:700;color:#0056b3;text-align:center">
          ${totalDays} ימים
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #eee;text-align:center">
          <a href="${reportUrl}"
             style="display:inline-block;background:#0056b3;color:#fff;padding:6px 16px;
                    border-radius:6px;text-decoration:none;font-size:13px;font-weight:700">
            דוח + הדפסה
          </a>
        </td>
      </tr>`;
  }).join('');

  const totalEmployees = sorted.length;
  const totalAllDays   = sorted.reduce((sum, emp) => sum + calcTotalDays(emp.requests, firstDay, lastDay), 0);

  const html = `
<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;direction:rtl;background:#eef2f7;padding:28px 16px;margin:0">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,86,0.10)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0056b3 0%,#0077e6 100%);padding:28px 36px;color:#fff;text-align:right">
      <div style="font-size:13px;font-weight:600;opacity:0.8;margin-bottom:6px;letter-spacing:1px;text-transform:uppercase">TECHNODA</div>
      <div style="font-size:22px;font-weight:700;margin-bottom:4px">דוח חופשות חודשי &mdash; ${monthLabel}</div>
      <div style="font-size:14px;opacity:0.85">מערכת חופשות טכנודע | נשלח אוטומטית ב-28 לחודש</div>
    </div>

    <!-- Summary -->
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

    <!-- Table -->
    <div style="padding:24px 28px">
      <div style="font-size:14px;font-weight:700;color:#555;margin-bottom:14px">רשימת עובדים (לפי א-ב) &mdash; לחץ על שם לדוח מפורט והדפסה</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#f4f6fa">
            <th style="padding:11px 16px;text-align:right;font-size:13px;color:#555;font-weight:700">שם העובד/ת</th>
            <th style="padding:11px 16px;text-align:center;font-size:13px;color:#555;font-weight:700">בקשות</th>
            <th style="padding:11px 16px;text-align:center;font-size:13px;color:#555;font-weight:700">ימי חופש</th>
            <th style="padding:11px 16px;text-align:center;font-size:13px;color:#555;font-weight:700">דוח</th>
          </tr>
        </thead>
        <tbody>
          ${employeeRows}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="background:#f4f6fa;padding:14px 28px;text-align:center;font-size:12px;color:#bbb;border-top:1px solid #eee">
      מערכת חופשות טכנודע &nbsp;|&nbsp; הודעה אוטומטית &mdash; ${monthLabel}
    </div>
  </div>
</div>`;

  // ── Send email ──────────────────────────────────────────
  GmailApp.sendEmail(
    REPORT_EMAILS,
    `דוח חופשות - ${monthLabel} (${totalEmployees} עובדים, ${totalAllDays} ימים)`,
    `דוח חופשות ${monthLabel} — פתח בדפדפן לתצוגה מלאה`,
    { htmlBody: html, name: 'מערכת חופשות טכנודע' }
  );

  Logger.log(`דוח חודשי נשלח ל-${REPORT_EMAILS} | ${monthLabel} | ${totalEmployees} עובדים`);
}

// ── Helpers ───────────────────────────────────────────────
function normalizeDates(dates) {
  if (!dates) return [];
  if (Array.isArray(dates)) return dates;
  return Object.values(dates);
}

function calcTotalDays(requests, firstDay, lastDay) {
  let total = 0;
  requests.forEach(r => {
    const dates = normalizeDates(r.dates);
    dates.forEach(d => {
      if (d.startDate > lastDay || d.endDate < firstDay) return;
      // Clip to month boundaries
      const start = d.startDate < firstDay ? firstDay : d.startDate;
      const end   = d.endDate   > lastDay  ? lastDay  : d.endDate;
      total += countWorkDays(start, end);
    });
  });
  return total;
}

function countWorkDays(start, end) {
  let count = 0;
  const cur = new Date(start + 'T00:00:00');
  const fin = new Date(end   + 'T00:00:00');
  while (cur <= fin) {
    const dow = cur.getDay();
    if (dow !== 5 && dow !== 6) count++; // skip Fri+Sat
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ── Test: run manually to check without waiting for the 28th ──
function testReport() {
  sendMonthlyReport();
}
