// ============================================================
// EMAIL.JS — EmailJS notifications + Calendar Invitations
//
// משתני תבנית EmailJS (template_fmr5r4q):
//   {{to_name}}  → כתובת המייל של הנמען (To Email)
//   {{name}}     → שם השולח (From Name)
//   {{email}}    → כתובת Reply-To
//   {{subject}}  → נושא המייל
//   {{message}}  → תוכן ההודעה
// ============================================================

// ── Send notification email via EmailJS ───────────────────
async function sendEmail({ toEmail, subject, message, fromName = "מערכת חופשות טכנודע" }) {
  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        to_name: toEmail,                    // "To Email" בתבנית
        name:    fromName,                   // "From Name" בתבנית
        email:   CALENDAR_GMAIL,            // "Reply To" בתבנית
        subject: subject,
        message: message
      },
      EMAILJS_PUBLIC_KEY
    );
    console.log(`✉️ מייל נשלח אל: ${toEmail} | נושא: ${subject}`);
  } catch (err) {
    console.error("❌ שגיאה בשליחת מייל:", err);
  }
}

// ── Build ICS (calendar invite) content ───────────────────
function buildICS({ summary, description, startDate, endDate, attendees }) {
  // endDate inclusive → iCal exclusive (מוסיפים יום)
  const end = new Date(endDate);
  end.setDate(end.getDate() + 1);

  const fmt = d => new Date(d).toISOString().replace(/[-:]/g, '').split('T')[0];
  const uid  = `vacation-${Date.now()}@technoda`;
  const now  = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

  const attendeeLines = attendees
    .map(a => `ATTENDEE;CN=${a.name};RSVP=TRUE:mailto:${a.email}`)
    .join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Technoda//Vacation System//HE',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${fmt(startDate)}`,
    `DTEND;VALUE=DATE:${fmt(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `ORGANIZER;CN=מערכת חופשות טכנודע:mailto:${CALENDAR_GMAIL}`,
    attendeeLines,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
}

// ── Apps Script Web App URL ────────────────────────────────
// הדבק כאן את ה-URL לאחר פריסה ב-Google Apps Script
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYlNxlAPowo6Ht1fTHC3Qb7MRra4fsQ63oFTJGnd681nGEYi4GCF6BwIPFUxAZ546j/exec"; // ← הדבק כאן את ה-URL

// ── Send calendar invite ───────────────────────────────────
async function sendCalendarInvite({ toEmails, summary, description, startDate, endDate }) {
  if (!APPS_SCRIPT_URL) {
    console.warn('⚠️ APPS_SCRIPT_URL חסר ב-email.js');
    return;
  }

  try {
    // no-cors: Apps Script redirects (302) ו-fetch לא יכול לקרוא תגובה מ-CORS שונה
    // אבל הבקשה מגיעה לשרת ומייצרת את הזימון — fire-and-forget
    await fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      mode:    'no-cors',               // ← זה הפתרון לבעיית ה-CORS redirect
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ toEmails, summary, description, startDate, endDate })
    });
    console.log('📅 בקשת זימון נשלחה ל-Apps Script');
  } catch (err) {
    console.error('❌ שגיאה בשליחת זימון:', err);
  }
}

function downloadICS(icsContent, summary) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${summary}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════
//  אירועי מייל ספציפיים
// ════════════════════════════════════════════════════════════

// בקשה חדשה → מייל למנהל
async function notifyManagerNewRequest(request) {
  if (!request.managerWorkEmail) return;
  await sendEmail({
    toEmail:  request.managerWorkEmail,
    subject:  `📋 בקשת חופש חדשה — ${request.userName}`,
    message:
      `שלום ${request.managerName},\n\n` +
      `${request.userName} הגיש/ה בקשת חופש:\n\n` +
      `📅 תאריכים: ${formatDates(request.dates)}\n` +
      `📌 סיבה: ${request.reason || '—'}\n\n` +
      `נא להיכנס למערכת לאישור / דחייה.\n\n` +
      `מערכת חופשות טכנודע`
  });
}

// בקשה אושרה → מייל לרכז + זימון לשניהם
async function notifyUserApproved(request) {
  await sendEmail({
    toEmail:  request.userWorkEmail,
    subject:  `✅ בקשת החופש שלך אושרה`,
    message:
      `שלום ${request.userName},\n\n` +
      `בקשת החופש שלך אושרה!\n\n` +
      `📅 תאריכים: ${formatDates(request.dates)}\n\n` +
      `זימון ביומן ישלח אליך בנפרד.\n\n` +
      `מערכת חופשות טכנודע`
  });

  // שליחת זימון לרכז ולמנהל
  const attendees = [
    { name: request.userName,    email: request.userWorkEmail    },
    { name: request.managerName, email: request.managerWorkEmail }
  ].filter(a => a.email);

  // Firebase מחזיר dates כ-object — ממירים למערך
  const dates = Array.isArray(request.dates)
    ? request.dates
    : Object.values(request.dates || {});

  for (const range of dates) {
    await sendCalendarInvite({
      toEmails:    attendees,
      summary:     `חופשה — ${request.userName}`,
      description: `חופשה מאושרת\nסיבה: ${request.reason || ''}`,
      startDate:   range.startDate,
      endDate:     range.endDate
    });
  }
}

// בקשה נדחתה → מייל לרכז
async function notifyUserRejected(request, managerMessage) {
  await sendEmail({
    toEmail:  request.userWorkEmail,
    subject:  `❌ בקשת החופש שלך נדחתה`,
    message:
      `שלום ${request.userName},\n\n` +
      `בקשת החופש שלך ל-${formatDates(request.dates)} נדחתה.\n\n` +
      `💬 הודעת המנהל/ת:\n"${managerMessage}"\n\n` +
      `ניתן לפתוח את המערכת ולהגיב.\n\n` +
      `מערכת חופשות טכנודע`
  });
}

// הודעה ממנהל → מייל לרכז
async function notifyUserMessage(request, messageText, managerName) {
  await sendEmail({
    toEmail:  request.userWorkEmail,
    subject:  `💬 הודעה חדשה לגבי בקשת החופש שלך`,
    message:
      `שלום ${request.userName},\n\n` +
      `${managerName} שלח/ה הודעה:\n\n"${messageText}"\n\n` +
      `ניתן להיכנס למערכת ולהשיב.\n\n` +
      `מערכת חופשות טכנודע`
  });
}

// תגובת רכז → מייל למנהל
async function notifyManagerReply(request, replyText) {
  if (!request.managerWorkEmail) return;
  await sendEmail({
    toEmail:  request.managerWorkEmail,
    subject:  `💬 תגובה לגבי בקשת חופש — ${request.userName}`,
    message:
      `שלום ${request.managerName},\n\n` +
      `${request.userName} הגיב/ה לבקשת החופש:\n\n"${replyText}"\n\n` +
      `ניתן להיכנס למערכת לטיפול.\n\n` +
      `מערכת חופשות טכנודע`
  });
}

// הודעת מנהל שהוא בחופש → לרכזים הנבחרים
async function notifyManagerOnVacation({ managerName, startDate, endDate, targets }) {
  for (const t of targets) {
    await sendEmail({
      toEmail:  t.workEmail,
      toName:   t.name,
      subject:  `📢 ${managerName} בחופשה`,
      message:
        `שלום ${t.name},\n\n` +
        `${managerName} נמצא/ת בחופשה בין התאריכים:\n` +
        `📅 ${formatDateHE(startDate)} — ${formatDateHE(endDate)}\n\n` +
        `מערכת חופשות טכנודע`
    });
  }
}

// ── Helpers ────────────────────────────────────────────────
function formatDates(dates) {
  if (!dates || !dates.length) return '—';
  return dates.map(d => {
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
