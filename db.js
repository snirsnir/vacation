// ============================================================
// DB.JS — Firebase Realtime Database operations
// ============================================================

let db;

function initDB(database) {
  db = database;
}

// ── Workers ────────────────────────────────────────────────

async function getWorkerByAuthEmail(authEmail) {
  const snap = await db.ref('workers')
    .orderByChild('authEmail')
    .equalTo(authEmail.toLowerCase())
    .once('value');
  const val = snap.val();
  if (!val) return null;
  const key = Object.keys(val)[0];
  return { id: key, ...val[key] };
}

async function getAllWorkers() {
  const snap = await db.ref('workers').once('value');
  const val = snap.val();
  if (!val) return [];
  return Object.entries(val).map(([id, w]) => ({ id, ...w }));
}

async function saveWorker(workerData) {
  const ref = db.ref('workers').push();
  await ref.set({ ...workerData, id: ref.key });
  return ref.key;
}

async function updateWorker(workerId, updates) {
  await db.ref(`workers/${workerId}`).update(updates);
}

async function toggleWorkerActive(workerId, active) {
  await db.ref(`workers/${workerId}`).update({ active });
}

// ── Legacy Users (backward compat) ────────────────────────

async function saveUser(uid, userData) {
  await db.ref(`users/${uid}`).set(userData);
}

async function getUser(uid) {
  const snap = await db.ref(`users/${uid}`).once('value');
  return snap.val();
}

// ── Vacation Requests ──────────────────────────────────────

async function createRequest(requestData) {
  const ref = db.ref('vacationRequests').push();
  await ref.set({ ...requestData, id: ref.key });
  return ref.key;
}

async function updateRequest(requestId, updates) {
  await db.ref(`vacationRequests/${requestId}`).update(updates);
}

async function getRequest(requestId) {
  const snap = await db.ref(`vacationRequests/${requestId}`).once('value');
  return snap.val();
}

async function getRequestsByUser(userId) {
  const snap = await db.ref('vacationRequests')
    .orderByChild('userId')
    .equalTo(userId)
    .once('value');
  const val = snap.val();
  if (!val) return [];
  return Object.values(val).sort((a, b) => b.createdAt - a.createdAt);
}

async function getRequestsByManager(managerAuthEmail) {
  const snap = await db.ref('vacationRequests')
    .orderByChild('managerAuthEmail')
    .equalTo(managerAuthEmail)
    .once('value');
  const val = snap.val();
  if (!val) return [];
  return Object.values(val).sort((a, b) => b.createdAt - a.createdAt);
}

function listenToUserRequests(userId, callback) {
  db.ref('vacationRequests')
    .orderByChild('userId')
    .equalTo(userId)
    .on('value', snap => {
      const val = snap.val();
      const list = val ? Object.values(val).sort((a, b) => b.createdAt - a.createdAt) : [];
      callback(list);
    });
}

function listenToManagerRequests(managerAuthEmail, callback) {
  db.ref('vacationRequests')
    .orderByChild('managerAuthEmail')
    .equalTo(managerAuthEmail)
    .on('value', snap => {
      const val  = snap.val();
      const list = val ? Object.values(val).sort((a, b) => b.createdAt - a.createdAt) : [];
      callback(list);
    });
}

// ── Messages ──────────────────────────────────────────────

async function addMessage(requestId, message) {
  const ref = db.ref(`vacationRequests/${requestId}/messages`).push();
  await ref.set({ ...message, id: ref.key });
}

function listenToMessages(requestId, callback) {
  db.ref(`vacationRequests/${requestId}/messages`).on('value', snap => {
    const val = snap.val();
    callback(val ? Object.values(val) : []);
  });
}

// ── Manager Announcements ──────────────────────────────────

async function createAnnouncement(data) {
  const ref = db.ref('managerAnnouncements').push();
  await ref.set({ ...data, id: ref.key });
  return ref.key;
}

async function getAnnouncementsForUser(userId) {
  const snap = await db.ref('managerAnnouncements').once('value');
  const val = snap.val();
  if (!val) return [];
  return Object.values(val).filter(a =>
    Array.isArray(a.visibleTo) && a.visibleTo.includes(userId)
  );
}

async function getMyAnnouncements(managerId) {
  const snap = await db.ref('managerAnnouncements')
    .orderByChild('managerId')
    .equalTo(managerId)
    .once('value');
  const val = snap.val();
  if (!val) return [];
  return Object.values(val);
}

async function deleteAnnouncement(id) {
  await db.ref(`managerAnnouncements/${id}`).remove();
}
