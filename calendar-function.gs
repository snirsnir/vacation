// ============================================================
// Google Apps Script — זימוני לוח שנה אמיתיים ל-Outlook
// Deploy: Web App | Execute as: Me | Who has access: Anyone
// ============================================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const startDate = new Date(data.startDate + 'T00:00:00');
    const endDate   = new Date(data.endDate   + 'T00:00:00');
    endDate.setDate(endDate.getDate() + 1); // iCal: endDate exclusive

    const guestList = data.toEmails.map(a => a.email).join(',');

    CalendarApp.getDefaultCalendar().createAllDayEvent(
      data.summary,
      startDate,
      endDate,
      {
        description: data.description || '',
        guests:      guestList,
        sendInvites: true
      }
    );

    Logger.log('✅ אירוע נוצר: ' + data.summary + ' | אורחים: ' + guestList);
    return buildResponse({ success: true });

  } catch (err) {
    Logger.log('❌ שגיאה: ' + err.toString());
    return buildResponse({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  return buildResponse({ status: 'ok', message: 'Calendar service is running' });
}

function buildResponse(data) {
  return ContentService
    .createTextResponse(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ⬇️ הרץ את הפונקציה הזו פעם אחת ידנית כדי לאשר הרשאות Calendar
// Script Editor → בחר "testPermissions" → לחץ ▶ Run
// ============================================================
function testPermissions() {
  try {
    const cal = CalendarApp.getDefaultCalendar();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const event = cal.createAllDayEvent(
      '✅ בדיקת הרשאות — מערכת חופשות טכנודע',
      tomorrow,
      dayAfter,
      {
        description: 'אירוע בדיקה — ניתן למחוק',
        guests: Session.getActiveUser().getEmail(),
        sendInvites: true
      }
    );

    Logger.log('✅ הרשאות תקינות! אירוע נוצר: ' + event.getId());
    // מחק את אירוע הבדיקה מיד
    event.deleteEvent();
    Logger.log('🗑️ אירוע הבדיקה נמחק');
  } catch (err) {
    Logger.log('❌ שגיאה בבדיקה: ' + err.toString());
  }
}
