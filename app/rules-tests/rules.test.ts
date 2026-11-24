/**
 * Proves firestore.rules against the Firestore emulator. Needs Java + Firebase CLI, so it
 * runs in CI (job "rules"), not with `npm test`. Locally, from the repo root:
 *   npx firebase-tools emulators:exec --only firestore --project demo-attendly "npm --prefix app run test:rules"
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, test, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { initializeTestEnvironment, assertSucceeds, assertFails, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, Timestamp, collection, getDocs } from 'firebase/firestore';

let env: RulesTestEnvironment;

const core = () => ({
  subjects: [{ id: 's1', name: 'Physics', color: '#16A34A', active: true }],
  slots: [],
  settings: { target: 75 },
  terms: [{ id: 'term-1', name: 'Term 1', start: '2026-07-01', end: '2026-11-30' }],
  schemaVersion: 3,
  updatedAt: serverTimestamp(),
  deviceId: 'd-test',
});
const month = (n = 1) => ({
  records: Array.from({ length: n }, (_, i) => ({ id: 'r' + i, slotId: 'sl1', subjectId: 's1', date: '2026-11-23', scheduledStart: '10:00', status: 'present' })),
  updatedAt: serverTimestamp(),
  deviceId: 'd-test',
});

const alice = () => env.authenticatedContext('alice', { email_verified: true }).firestore();
const aliceUnverified = () => env.authenticatedContext('alice', { email_verified: false }).firestore();
const bob = () => env.authenticatedContext('bob', { email_verified: true }).firestore();
const nobody = () => env.unauthenticatedContext().firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-attendly',
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

describe('owner (verified)', () => {
  test('can write and read their core document', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/data/core'), core()));
    await assertSucceeds(getDoc(doc(alice(), 'users/alice/data/core')));
  });
  test('can write, list and delete their month documents', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/months/2026-11'), month(3)));
    await assertSucceeds(getDocs(collection(alice(), 'users/alice/months')));
    await assertSucceeds(deleteDoc(doc(alice(), 'users/alice/months/2026-11')));
  });
});

describe('everyone else is refused', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'users/alice/data/core'), { ...core(), updatedAt: Timestamp.now() }); });
  });
  test('signed out: no read, no write', async () => {
    await assertFails(getDoc(doc(nobody(), 'users/alice/data/core')));
    await assertFails(setDoc(doc(nobody(), 'users/alice/data/core'), core()));
  });
  test("another user: can't read, write, list or delete alice's data", async () => {
    await assertFails(getDoc(doc(bob(), 'users/alice/data/core')));
    await assertFails(setDoc(doc(bob(), 'users/alice/data/core'), core()));
    await assertFails(getDocs(collection(bob(), 'users/alice/months')));
    await assertFails(deleteDoc(doc(bob(), 'users/alice/data/core')));
  });
  test('the owner with an unverified email is refused', async () => {
    await assertFails(getDoc(doc(aliceUnverified(), 'users/alice/data/core')));
    await assertFails(setDoc(doc(aliceUnverified(), 'users/alice/months/2026-11'), month()));
  });
  test('paths outside users/{uid} are closed', async () => {
    await assertFails(setDoc(doc(alice(), 'public/notes'), { x: 1 }));
    await assertFails(getDocs(collection(alice(), 'users')));
  });
});

describe('document shape is enforced', () => {
  test('unknown fields are rejected', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/data/core'), { ...core(), isAdmin: true }));
    await assertFails(setDoc(doc(alice(), 'users/alice/months/2026-11'), { ...month(), extra: 'x' }));
  });
  test('missing fields are rejected', async () => {
    const { settings: _s, ...noSettings } = core();
    await assertFails(setDoc(doc(alice(), 'users/alice/data/core'), noSettings));
  });
  test('more than 50 terms are rejected', async () => {
    const terms = Array.from({ length: 51 }, (_, i) => ({ id: 't' + i, name: 'T', start: '2026-01-01', end: '2026-01-02' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/data/core'), { ...core(), terms }));
  });
  test('wrong types are rejected', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/data/core'), { ...core(), subjects: 'not a list' }));
    await assertFails(setDoc(doc(alice(), 'users/alice/data/core'), { ...core(), schemaVersion: '2' }));
  });
  test('a client-chosen time is rejected (must be the server clock)', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/data/core'), { ...core(), updatedAt: Timestamp.fromDate(new Date('2099-01-01')) }));
  });
  test('bad month ids are rejected', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/months/2026-13'), month()));
    await assertFails(setDoc(doc(alice(), 'users/alice/months/latest'), month()));
  });
  test('oversized months are rejected', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/months/2026-10'), month(2000)));
    await assertFails(setDoc(doc(alice(), 'users/alice/months/2026-11'), month(2001)));
  });
});
