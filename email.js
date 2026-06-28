// ============================================================
// EMAIL.JS — EmailJS notifications + Calendar Invitations
//
// הגדרות EmailJS הנדרשות בדשבורד:
//   Subject  → {{subject}}       (לא ערך קבוע!)
//   Content  → {{{message}}}     (שלוש סוגריים — מאפשר HTML)
//   to_name  → כתובת מייל הנמען
//   name     → שם שולח
//   email    → reply-to
// ============================================================

// ── HTML email wrapper ────────────────────────────────────
function emailHtml(bodyContent) {
  return `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;direction:rtl;background:#eef2f7;padding:28px 16px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,86,0.10)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0056b3 0%,#0073e6 100%);padding:28px 32px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">🏖️</div>
      <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px">מערכת חופשות טכנודע</div>
    </div>

    <!-- Body -->
    <div style="padding:32px 36px;color:#1a1a1a;font-size:15px;line-height:1.8">
      ${bodyContent}
    </div>

    <!-- CTA Button -->
    <div style="padding:0 36px 32px;text-align:center">
      <a href="${SYSTEM_URL}"
         style="display:inline-block;background:#0056b3;color:#ffffff;padding:14px 40px;
                border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;
                font-family:Arial,sans-serif;letter-spacing:0.3px">
        ▶&nbsp; כניסה למערכת
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#f4f6fa;padding:16px 32px;text-align:center;font-size:12px;color:#aaa;border-top:1px solid #eaecef">
      מערכת חופשות טכנודע &nbsp;|&nbsp; הודעה אוטומטית — אין להשיב למייל זה
    </div>
  </div>
</div>`;
}

// ── Styled info box ───────────────────────────────────────
function infoBox(rows, borderColor = '#0056b3', bgColor = '#f0f6ff') {
  return `<div style="background:${bgColor};border-right:4px solid ${borderColor};padding:14px 18px;border-radius:6px;margin:18px 0;font-size:14px;line-height:2">
    ${rows.map(r => `<div>${r}</div>`).join('')}
  </div>`;
}

// ── Send via EmailJS ──────────────────────────────────────
async function sendEmail({ toEmail, subject, message, fromName = 'מערכת חופשות טכנודע' }) {
  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      { to_name: toEmail, name: fromName, email: CALENDAR_GMAIL, subject, message },
      EMAILJS_PUBLIC_KEY
    );
    console.log(`✉️ מייל נשלח → ${toEmail} | ${subject}`);
  } catch (err) {
    console.error('❌ שגיאה בשליחת מייל:', err);
  }
}

// ════════════════════════════════════════════════════════════
//  אירועי מייל
// ════════════════════════════════════════════════════════════

// בקשה חדשה → מייל למנהל
async function notifyManagerNewRequest(request) {
  if (!request.managerWorkEmail) return;
  await sendEmail({
    toEmail: request.managerWorkEmail,
    subject: `📋 בקשת חופש חדשה — ${request.userName}`,
    message: emailHtml(`
      <p>שלום <strong>${request.managerName}</strong>,</p>
      <p><strong>${request.userName}</strong> הגיש/ה בקשת חופש חדשה:</p>
      ${infoBox([
        `📅 <strong>תאריכים:</strong>&nbsp; ${formatDates(request.dates)}`,
        `📌 <strong>סיבה:</strong>&nbsp; ${request.reason || '—'}`
      ])}
      <p style="color:#555;font-size:14px">נא להיכנס למערכת לאישור או דחייה.</p>
    `)
  });
}

// בקשה אושרה → מייל לרכז
async function notifyUserApproved(request) {
  await sendEmail({
    toEmail: request.userWorkEmail,
    subject: `✅ בקשת החופש שלך אושרה`,
    message: emailHtml(`
      <p>שלום <strong>${request.userName}</strong>,</p>
      <p style="font-size:17px">🎉 בקשת החופש שלך <strong style="color:#1a7f4b">אושרה!</strong></p>
      ${infoBox([
        `📅 <strong>תאריכים:</strong>&nbsp; ${formatDates(request.dates)}`
      ], '#1a7f4b', '#e8f7ee')}
    `)
  });
}

// בקשה אושרה חלקית → מייל לרכז
async function notifyUserPartialApproval(request) {
  const approvedStr = formatDates(request.approvedDates || []);
  await sendEmail({
    toEmail: request.userWorkEmail,
    subject: `🔶 בקשת החופש שלך אושרה חלקית`,
    message: emailHtml(`
      <p>שלום <strong>${request.userName}</strong>,</p>
      <p>בקשת החופש שלך <strong style="color:#e67e22">אושרה חלקית</strong>.</p>
      ${infoBox([
        `✅ <strong>תקופות שאושרו:</strong>&nbsp; ${approvedStr}`
      ], '#e67e22', '#fef6ec')}
      <p style="color:#555;font-size:14px">ניתן להיכנס למערכת, לראות את הפרטים ולהגיש ערעור אם נדרש.</p>
    `)
  });
}

// בקשה נדחתה → מייל לרכז
async function notifyUserRejected(request, managerMessage) {
  await sendEmail({
    toEmail: request.userWorkEmail,
    subject: `❌ בקשת החופש שלך נדחתה`,
    message: emailHtml(`
      <p>שלום <strong>${request.userName}</strong>,</p>
      <p>בקשת החופש שלך ל-<strong>${formatDates(request.dates)}</strong> נדחתה.</p>
      ${managerMessage ? infoBox([
        `💬 <strong>הודעת המנהל/ת:</strong><br><em>"${managerMessage}"</em>`
      ], '#c0392b', '#fdf0ee') : ''}
      <p style="color:#555;font-size:14px">ניתן לפתוח את המערכת ולהגיב.</p>
    `)
  });
}

// הודעה ממנהל → מייל לרכז
async function notifyUserMessage(request, messageText, managerName) {
  await sendEmail({
    toEmail: request.userWorkEmail,
    subject: `💬 הודעה חדשה לגבי בקשת החופש שלך`,
    message: emailHtml(`
      <p>שלום <strong>${request.userName}</strong>,</p>
      <p><strong>${managerName}</strong> שלח/ה הודעה:</p>
      ${infoBox([`<em>"${messageText}"</em>`])}
      <p style="color:#555;font-size:14px">ניתן להיכנס למערכת ולהשיב.</p>
    `)
  });
}

// תגובת רכז → מייל למנהל
async function notifyManagerReply(request, replyText) {
  if (!request.managerWorkEmail) return;
  await sendEmail({
    toEmail: request.managerWorkEmail,
    subject: `💬 תגובה לגבי בקשת חופש — ${request.userName}`,
    message: emailHtml(`
      <p>שלום <strong>${request.managerName}</strong>,</p>
      <p><strong>${request.userName}</strong> הגיב/ה לבקשת החופש:</p>
      ${infoBox([`<em>"${replyText}"</em>`])}
      <p style="color:#555;font-size:14px">ניתן להיכנס למערכת לטיפול.</p>
    `)
  });
}

// מנהל בחופש → לרכזים הנבחרים
async function notifyManagerOnVacation({ managerName, startDate, endDate, targets }) {
  for (const t of targets) {
    await sendEmail({
      toEmail: t.workEmail,
      subject: `📢 ${managerName} בחופשה`,
      message: emailHtml(`
        <p>שלום <strong>${t.name}</strong>,</p>
        <p><strong>${managerName}</strong> נמצא/ת בחופשה:</p>
        ${infoBox([
          `📅 <strong>תאריכים:</strong>&nbsp; ${formatDateHE(startDate)} — ${formatDateHE(endDate)}`
        ])}
      `)
    });
  }
}

// ════════════════════════════════════════════════════════════
//  Calendar Invite (Apps Script)
// ════════════════════════════════════════════════════════════

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbygm-ixpLNvKNqk440whZP1aur22d8UAjsU_IOqKdAIdeZB89lmYC_iAealqgOkRSQ0/exec";

async function sendCalendarInvite({ toEmails, summary, description, startDate, endDate }) {
  if (!APPS_SCRIPT_URL) return;
  try {
    const payload = encodeURIComponent(JSON.stringify({ toEmails, summary, description, startDate, endDate }));
    await fetch(`${APPS_SCRIPT_URL}?payload=${payload}`, { method: 'GET', mode: 'no-cors' });
    console.log('📅 בקשת זימון נשלחה ל-Apps Script');
  } catch (err) {
    console.error('❌ שגיאה בשליחת זימון:', err);
  }
}

// ── Helpers ────────────────────────────────────────────────
function formatDates(dates) {
  if (!dates || !dates.length) return '—';
  const arr = Array.isArray(dates) ? dates : Object.values(dates);
  return arr.map(d => {
    const s = formatDateHE(d.startDate);
    const e = formatDateHE(d.endDate);
    return s === e ? s : `${s} – ${e}`;
  }).join(', ');
}

function formatDateHE(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}
