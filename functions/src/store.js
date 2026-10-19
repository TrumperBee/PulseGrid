'use strict';
// Firestore repository via firebase-admin (Admin SDK — bypasses security rules).
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const repo = {
  async listAllActiveMonitors() {
    const snap = await db.collection('monitors').where('isActive', '==', true).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async listMonitorsForUser(uid) {
    const snap = await db.collection('monitors').where('userId', '==', uid).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.isActive !== false);
  },

  async getMonitor(monitorId) {
    const d = await db.collection('monitors').doc(monitorId).get();
    return d.exists ? { id: d.id, ...d.data() } : null;
  },

  async getOpenIncidents(monitorId) {
    const snap = await db.collection('incidents')
      .where('monitorId', '==', monitorId)
      .where('isResolved', '==', false)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async createIncident(data) {
    await db.collection('incidents').add({ ...data, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  },

  async resolveIncident(incidentId, extra = {}) {
    await db.collection('incidents').doc(incidentId).update({
      isResolved: true,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(extra.timeline ? { timeline: admin.firestore.FieldValue.arrayUnion(...extra.timeline) } : {}),
    });
  },

  async updateMonitor(monitorId, updates) {
    const payload = { ...updates, lastCheck: admin.firestore.FieldValue.serverTimestamp() };
    // nextCheckAt is a real Date — Firestore stores it as a timestamp, fine for due-filtering.
    await db.collection('monitors').doc(monitorId).update(payload);
  },

  async getUser(uid) {
    const d = await db.collection('users').doc(uid).get();
    return d.exists ? d.data() : null;
  },
};

module.exports = { repo, admin };
