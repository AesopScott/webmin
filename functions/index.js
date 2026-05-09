const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { Octokit } = require('@octokit/rest');

initializeApp();
const db = getFirestore();

const ALL_SECTIONS = ['providers', 'locations', 'services', 'careers', 'patients', 'news'];

const SECTION_DEFAULTS = {
  providers: [],
  locations: [],
  services: [],
  careers: { benefits: [], faqs: [] },
  patients: { insurance: [], forms: [], rights: [], responsibilities: [] },
  posts: [],
};

function canAccess(userSections, section) {
  if (!Array.isArray(userSections)) return false;
  if (userSections.includes('*')) return true;
  return userSections.includes(section);
}

async function getUserDoc(uid) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) throw { code: 404, message: 'User profile not found' };
  return snap.data();
}

async function getAccountDoc(accountId) {
  const snap = await db.collection('accounts').doc(accountId).get();
  if (!snap.exists) throw { code: 404, message: `Account "${accountId}" not found` };
  return snap.data();
}

async function verifyAuth(req) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) throw { code: 401, message: 'Login required' };
  const decoded = await getAuth().verifyIdToken(token);
  return decoded;
}

function route(fn) {
  return onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
      const result = await fn(req);
      res.json(result);
    } catch (e) {
      const status = Number.isInteger(e.code) && e.code >= 100 ? e.code : 500;
      console.error('Function error:', e.code, e.message, e.stack || '');
      res.status(status).json({ error: e.message || 'Internal error' });
    }
  });
}

// ── Section read ──────────────────────────────────────────────────────────────
exports.getSection = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, section } = req.body;

  const user = await getUserDoc(uid);
  if (user.accountId !== accountId) throw { code: 403, message: 'Wrong account' };
  if (!canAccess(user.sections, section)) throw { code: 403, message: 'Access denied' };

  const account = await getAccountDoc(accountId);
  const octokit = new Octokit({ auth: account.githubToken });

  try {
    const { data } = await octokit.repos.getContent({
      owner: account.githubOwner,
      repo: account.githubRepo,
      path: `src/data/${section}.json`,
    });
    const text = Buffer.from(data.content, 'base64').toString('utf8').replace(/^﻿/, '');
    return {
      items: JSON.parse(text),
      sha: data.sha,
    };
  } catch (err) {
    if (err.status === 404) return { items: SECTION_DEFAULTS[section] ?? [], sha: null };
    throw err;
  }
});

// ── Section write ─────────────────────────────────────────────────────────────
exports.saveSection = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, section, items, sha } = req.body;

  const user = await getUserDoc(uid);
  if (user.accountId !== accountId) throw { code: 403, message: 'Wrong account' };
  if (!canAccess(user.sections, section)) throw { code: 403, message: 'Access denied' };

  const account = await getAccountDoc(accountId);
  const octokit = new Octokit({ auth: account.githubToken });

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: account.githubOwner,
    repo: account.githubRepo,
    path: `src/data/${section}.json`,
    message: `webmin: update ${section}`,
    content: Buffer.from(JSON.stringify(items, null, 2)).toString('base64'),
    sha,
  });
  return { ok: true, sha: data.content.sha };
});

// ── Settings read (admin) ─────────────────────────────────────────────────────
exports.getSettings = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId } = req.body;

  const user = await getUserDoc(uid);
  if (!user.isAdmin || user.accountId !== accountId) throw { code: 403, message: 'Admins only' };

  const account = await getAccountDoc(accountId).catch(() => ({}));
  return {
    githubOwner: account.githubOwner || '',
    githubRepo: account.githubRepo || '',
    tokenSet: !!account.githubToken,
  };
});

// ── Settings write (admin) ────────────────────────────────────────────────────
exports.saveSettings = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, githubOwner, githubRepo, githubToken } = req.body;

  const user = await getUserDoc(uid);
  if (!user.isAdmin || user.accountId !== accountId) throw { code: 403, message: 'Admins only' };

  const update = { githubOwner, githubRepo };
  if (githubToken) update.githubToken = githubToken;

  await db.collection('accounts').doc(accountId).set(update, { merge: true });
  return { ok: true };
});

// ── Get account users (admin) ─────────────────────────────────────────────────
exports.getAccountUsers = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId } = req.body;

  const user = await getUserDoc(uid);
  if (!user.isAdmin || user.accountId !== accountId) throw { code: 403, message: 'Admins only' };

  const snap = await db.collection('users').where('accountId', '==', accountId).get();
  const users = snap.docs.map((d) => ({
    uid: d.id,
    name: d.data().name,
    email: d.data().email,
    sections: d.data().sections || [],
    isAdmin: d.data().isAdmin || false,
  }));
  return { users, allSections: ALL_SECTIONS };
});

// ── Update user sections (admin) ──────────────────────────────────────────────
exports.updateUserSections = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, targetUid, sections } = req.body;

  const user = await getUserDoc(uid);
  if (!user.isAdmin || user.accountId !== accountId) throw { code: 403, message: 'Admins only' };

  await db.collection('users').doc(targetUid).update({ sections });
  return { ok: true };
});

// ── Image upload ──────────────────────────────────────────────────────────────
exports.uploadImage = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, filename, content } = req.body;

  const user = await getUserDoc(uid);
  if (user.accountId !== accountId) throw { code: 403, message: 'Wrong account' };

  const account = await getAccountDoc(accountId);
  const octokit = new Octokit({ auth: account.githubToken });
  const path = `public/img/${filename}`;

  let sha;
  try {
    const { data } = await octokit.repos.getContent({
      owner: account.githubOwner, repo: account.githubRepo, path,
    });
    sha = data.sha;
  } catch (_) {}

  await octokit.repos.createOrUpdateFileContents({
    owner: account.githubOwner,
    repo: account.githubRepo,
    path,
    message: `webmin: upload image ${filename}`,
    content,
    ...(sha ? { sha } : {}),
  });

  return { ok: true, path: `/img/${filename}` };
});

// ── Create user (admin) ───────────────────────────────────────────────────────
exports.createUser = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, email, name, password, isAdmin } = req.body;

  const caller = await getUserDoc(uid);
  if (!caller.isAdmin || caller.accountId !== accountId) throw { code: 403, message: 'Admins only' };

  const newUser = await getAuth().createUser({ email, password, displayName: name });
  await db.collection('users').doc(newUser.uid).set({
    name,
    email,
    accountId,
    sections: [],
    isAdmin: isAdmin || false,
  });

  return { uid: newUser.uid, name, email, sections: [], isAdmin: isAdmin || false };
});

// ── Delete user (admin) ───────────────────────────────────────────────────────
exports.deleteUser = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, targetUid } = req.body;

  const caller = await getUserDoc(uid);
  if (!caller.isAdmin || caller.accountId !== accountId) throw { code: 403, message: 'Admins only' };
  if (targetUid === uid) throw { code: 400, message: 'Cannot delete your own account' };

  await getAuth().deleteUser(targetUid);
  await db.collection('users').doc(targetUid).delete();
  return { ok: true };
});

// ── Set user admin flag (admin) ───────────────────────────────────────────────
exports.setUserAdmin = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, targetUid, isAdmin } = req.body;

  const caller = await getUserDoc(uid);
  if (!caller.isAdmin || caller.accountId !== accountId) throw { code: 403, message: 'Admins only' };
  if (targetUid === uid) throw { code: 400, message: 'Cannot change your own admin status' };

  await db.collection('users').doc(targetUid).update({ isAdmin });
  return { ok: true };
});

// ── Get current user's own profile ────────────────────────────────────────────
exports.getMyProfile = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const user = await getUserDoc(uid);
  return {
    name: user.name,
    email: user.email,
    accountId: user.accountId,
    sections: user.sections || [],
    isAdmin: user.isAdmin || false,
  };
});
