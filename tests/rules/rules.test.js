'use strict';
// Firestore security rules tests for PulseGrid.
// Run from the repo root:  npm run test:rules
// (uses firebase emulators:exec with project "demo-pulsegrid" — never the real project)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} = require('firebase/firestore');

const RULES = readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8');

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-pulsegrid',
    firestore: { rules: RULES },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'monitors', 'mon-alice'), { userId: 'alice', name: 'Alice API', status: 'up' });
    await setDoc(doc(db, 'monitors', 'mon-bob'), { userId: 'bob', name: 'Bob API', status: 'up' });
    await setDoc(doc(db, 'users', 'alice'), { uid: 'alice', email: 'alice@example.com', plan: 'pro' });
    await setDoc(doc(db, 'incidents', 'inc-1'), { userId: 'alice', monitorId: 'mon-alice', isResolved: false });
    await setDoc(doc(db, 'statusPages', 'sp-1'), { userId: 'alice', slug: 'alice-status', isPublished: false });
  });
});

after(async () => {
  if (env) await env.cleanup();
});

const aliceDb = () => env.authenticatedContext('alice').firestore();
const bobDb = () => env.authenticatedContext('bob').firestore();
const anonDb = () => env.unauthenticatedContext().firestore();

// ---------- default deny / unauthenticated ----------
test('unauthenticated cannot read a monitor', async () => {
  await assertFails(getDoc(doc(anonDb(), 'monitors', 'mon-alice')));
});

test('unauthenticated cannot read a user profile', async () => {
  await assertFails(getDoc(doc(anonDb(), 'users', 'alice')));
});

test('unauthenticated cannot read incidents or status pages', async () => {
  await assertFails(getDoc(doc(anonDb(), 'incidents', 'inc-1')));
  await assertFails(getDoc(doc(anonDb(), 'statusPages', 'sp-1')));
});

test('unlisted collection (email_queue) is denied even when authenticated', async () => {
  await assertFails(getDoc(doc(aliceDb(), 'email_queue', 'x')));
  await assertFails(setDoc(doc(aliceDb(), 'email_queue', 'x'), { to: 'a@b.c' }));
});

// ---------- monitors ----------
test('owner can read their own monitor', async () => {
  await assertSucceeds(getDoc(doc(aliceDb(), 'monitors', 'mon-alice')));
});

test('other authenticated user cannot read someone else\'s monitor', async () => {
  await assertFails(getDoc(doc(bobDb(), 'monitors', 'mon-alice')));
});

test('owner can create a monitor only under their own uid', async () => {
  await assertSucceeds(setDoc(doc(aliceDb(), 'monitors', 'mon-new'), {
    userId: 'alice', name: 'New', url: 'https://example.com', isActive: true,
  }));
  await assertFails(setDoc(doc(aliceDb(), 'monitors', 'mon-spoof'), {
    userId: 'bob', name: 'Spoofed', url: 'https://example.com', isActive: true,
  }));
});

test('owner can update own monitor but cannot transfer ownership', async () => {
  await assertSucceeds(updateDoc(doc(aliceDb(), 'monitors', 'mon-new'), { status: 'down', isPaused: true }));
  await assertFails(updateDoc(doc(aliceDb(), 'monitors', 'mon-new'), { userId: 'bob' }));
});

test('non-owner cannot update or delete another user\'s monitor', async () => {
  await assertFails(updateDoc(doc(bobDb(), 'monitors', 'mon-alice'), { status: 'down' }));
  await assertFails(deleteDoc(doc(bobDb(), 'monitors', 'mon-alice')));
});

test('owner can delete own monitor', async () => {
  await assertSucceeds(deleteDoc(doc(aliceDb(), 'monitors', 'mon-new')));
});

// ---------- users ----------
test('user can create only their own user document with matching uid', async () => {
  await assertSucceeds(setDoc(doc(env.authenticatedContext('erin').firestore(), 'users', 'erin'), { uid: 'erin', email: 'e@example.com' }));
  // Alice cannot create a document under someone else's uid
  await assertFails(setDoc(doc(aliceDb(), 'users', 'dave'), { uid: 'dave', email: 'd@example.com' }));
});

test('user cannot read or edit another user\'s profile', async () => {
  await assertFails(getDoc(doc(bobDb(), 'users', 'alice')));
  await assertFails(updateDoc(doc(bobDb(), 'users', 'alice'), { plan: 'pro' }));
});

test('owner update cannot reassign uid', async () => {
  await assertFails(updateDoc(doc(aliceDb(), 'users', 'alice'), { uid: 'someone-else' }));
  await assertSucceeds(updateDoc(doc(aliceDb(), 'users', 'alice'), { fullName: 'Alice A.' }));
});

// ---------- incidents: server-owned, client write-denied ----------
test('owner can read their incidents, but NO client can write them', async () => {
  await assertSucceeds(getDoc(doc(aliceDb(), 'incidents', 'inc-1')));
  await assertFails(getDoc(doc(bobDb(), 'incidents', 'inc-1')));
  // Even the owner may not create/modify incidents — only the server (Admin SDK) can.
  await assertFails(setDoc(doc(aliceDb(), 'incidents', 'inc-2'), { userId: 'alice', isResolved: false }));
  await assertFails(updateDoc(doc(aliceDb(), 'incidents', 'inc-1'), { isResolved: true }));
  await assertFails(deleteDoc(doc(aliceDb(), 'incidents', 'inc-1')));
});

// ---------- status pages ----------
test('owner can CRUD own status page; others cannot', async () => {
  await assertSucceeds(updateDoc(doc(aliceDb(), 'statusPages', 'sp-1'), { isPublished: true }));
  await assertFails(getDoc(doc(bobDb(), 'statusPages', 'sp-1')));
  await assertFails(updateDoc(doc(bobDb(), 'statusPages', 'sp-1'), { isPublished: true }));
  await assertSucceeds(deleteDoc(doc(aliceDb(), 'statusPages', 'sp-1')));
});

test('status page create requires matching userId', async () => {
  await assertFails(setDoc(doc(aliceDb(), 'statusPages', 'sp-x'), { userId: 'bob', slug: 'x' }));
  await assertSucceeds(setDoc(doc(aliceDb(), 'statusPages', 'sp-y'), { userId: 'alice', slug: 'y' }));
});
