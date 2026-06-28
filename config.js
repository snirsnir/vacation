// ============================================================
// CONFIG.JS — Firebase, EmailJS, Credentials
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAuNj1ANkPpa39vUgegUI0rrB3H_2CyeBA",
  authDomain: "vacation-788ea.firebaseapp.com",
  databaseURL: "https://vacation-788ea-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "vacation-788ea",
  storageBucket: "vacation-788ea.firebasestorage.app",
  messagingSenderId: "437422720540",
  appId: "1:437422720540:web:3e21b267a11064032f41d9"
};

const EMAILJS_SERVICE_ID  = "service_qn28exb";
const EMAILJS_TEMPLATE_ID = "template_fmr5r4q";
const EMAILJS_PUBLIC_KEY  = "Y0yqKFQQ4ONQ4j396";

const CALENDAR_GMAIL    = "tech.boker@gmail.com";
const CALENDAR_APP_PASS = "bwzt zuaa yezl hton";

const SYSTEM_URL = "https://snirsnir.github.io/vacation/";

// Gmail addresses that can access dashboard.html
const DASHBOARD_EMAILS = [
  "snirdoani@gmail.com",   // שניר דואני
  "shulisason@gmail.com",  // שולי ששון
  // רונית יאיר — יש להוסיף כתובת Gmail שלה כשתתווסף למערכת
];

// Gmail addresses that can access admin.html
const ADMIN_EMAILS = [
  "gadimador@gmail.com",          // גדי מדור
  "emilygolan1@gmail.com",        // אמילי גולן
  "maayan.schvartzer@gmail.com",  // מעיין שוורצר
  "kerenbaileydahan@gmail.com",   // קרן דהן
  "meidankadosh@gmail.com",       // מידן קדוש
  "shulisason@gmail.com",         // שולי ששון
  "snirdoani@gmail.com",          // שניר דואני
  "lironlidi@gmail.com",          // לירון אהרן
];

// חגים ומועדים — מוחרגים מספירת ימי החופש
const HOLIDAYS = [
  { name: 'ראש השנה',           start: '2026-09-11', end: '2026-09-13' },
  { name: 'יום הכיפורים',        start: '2026-09-20', end: '2026-09-21' },
  { name: 'בין כיפור לסוכות',   start: '2026-09-22', end: '2026-09-24' },
  { name: 'סוכות',              start: '2026-09-25', end: '2026-10-03' },
  { name: 'חנוכה',              start: '2026-12-06', end: '2026-12-12' },
  { name: 'פורים',              start: '2027-03-23', end: '2027-03-24' },
  { name: 'פסח',                start: '2027-04-13', end: '2027-04-28' },
  { name: 'יום העצמאות',        start: '2027-05-12', end: '2027-05-12' },
  { name: 'שבועות',             start: '2027-06-10', end: '2027-06-11' },
];
