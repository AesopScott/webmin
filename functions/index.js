const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { Octokit } = require('@octokit/rest');

initializeApp();
const db = getFirestore();

const ALL_SECTIONS = ['providers', 'locations', 'services', 'careers', 'patients', 'news'];

function canAccess(userSections, section) {
  if (!Array.isArray(userSections)) return false;
  if (userSections.includes('*')) return true;
  return userSections.includes(section);
}

async function getUserDoc(uid) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) throw new HttpsError('not-found', 'User profile not found');
  return snap.data();
}

async function getAccountDoc(accountId) {
  const snap = await db.collection('accounts').doc(accountId).get();
  if (!snap.exists) throw new HttpsError('not-found', `Account "${accountId}" not found`);
  return snap.data();
}

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  return request.auth;
}

// ── Section read ──────────────────────────────────────────────────────────────
exports.getSection = onCall(async (request) => {
  const { uid } = requireAuth(request);
  const { accountId, section } = request.data;

  const user = await getUserDoc(uid);
  if (user.accountId !== accountId) throw new HttpsError('permission-denied', 'Wrong account');
  if (!canAccess(user.sections, section)) throw new HttpsError('permission-denied', 'Access denied');

  const account = await getAccountDoc(accountId);
  const octokit = new Octokit({ auth: account.githubToken });

  try {
    const { data } = await octokit.repos.getContent({
      owner: account.githubOwner,
      repo: account.githubRepo,
      path: `src/data/${section}.json`,
    });
    return {
      items: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')),
      sha: data.sha,
    };
  } catch (e) {
    throw new HttpsError('internal', e.message);
  }
});

// ── Section write ─────────────────────────────────────────────────────────────
exports.saveSection = onCall(async (request) => {
  const { uid } = requireAuth(request);
  const { accountId, section, items, sha } = request.data;

  const user = await getUserDoc(uid);
  if (user.accountId !== accountId) throw new HttpsError('permission-denied', 'Wrong account');
  if (!canAccess(user.sections, section)) throw new HttpsError('permission-denied', 'Access denied');

  const account = await getAccountDoc(accountId);
  const octokit = new Octokit({ auth: account.githubToken });

  try {
    await octokit.repos.createOrUpdateFileContents({
      owner: account.githubOwner,
      repo: account.githubRepo,
      path: `src/data/${section}.json`,
      message: `webmin: update ${section}`,
      content: Buffer.from(JSON.stringify(items, null, 2)).toString('base64'),
      sha,
    });
    return { ok: true };
  } catch (e) {
    throw new HttpsError('internal', e.message);
  }
});

// ── Settings read (admin) ─────────────────────────────────────────────────────
exports.getSettings = onCall(async (request) => {
  const { uid } = requireAuth(request);
  const { accountId } = request.data;

  const user = await getUserDoc(uid);
  if (!user.isAdmin || user.accountId !== accountId) {
    throw new HttpsError('permission-denied', 'Admins only');
  }

  const account = await getAccountDoc(accountId).catch(() => ({}));
  return {
    githubOwner: account.githubOwner || '',
    githubRepo: account.githubRepo || '',
    tokenSet: !!account.githubToken,
  };
});

// ── Settings write (admin) ────────────────────────────────────────────────────
exports.saveSettings = onCall(async (request) => {
  const { uid } = requireAuth(request);
  const { accountId, githubOwner, githubRepo, githubToken } = request.data;

  const user = await getUserDoc(uid);
  if (!user.isAdmin || user.accountId !== accountId) {
    throw new HttpsError('permission-denied', 'Admins only');
  }

  const update = { githubOwner, githubRepo };
  if (githubToken) update.githubToken = githubToken;

  await db.collection('accounts').doc(accountId).set(update, { merge: true });
  return { ok: true };
});

// ── Get account users (admin) ─────────────────────────────────────────────────
exports.getAccountUsers = onCall(async (request) => {
  const { uid } = requireAuth(request);
  const { accountId } = request.data;

  const user = await getUserDoc(uid);
  if (!user.isAdmin || user.accountId !== accountId) {
    throw new HttpsError('permission-denied', 'Admins only');
  }

  const snap = await db.collection('users').where('accountId', '==', accountId).get();
  const users = snap.docs.map((d) => ({
    uid: d.id,
    name: d.data().name,
    email: d.data().email,
    sections: d.data().sections,
    isAdmin: d.data().isAdmin || false,
  }));
  return { users, allSections: ALL_SECTIONS };
});

// ── Update user sections (admin) ──────────────────────────────────────────────
exports.updateUserSections = onCall(async (request) => {
  const { uid } = requireAuth(request);
  const { accountId, targetUid, sections } = request.data;

  const user = await getUserDoc(uid);
  if (!user.isAdmin || user.accountId !== accountId) {
    throw new HttpsError('permission-denied', 'Admins only');
  }

  await db.collection('users').doc(targetUid).update({ sections });
  return { ok: true };
});

// ── Get current user's own profile ────────────────────────────────────────────
exports.getMyProfile = onCall(async (request) => {
  const { uid } = requireAuth(request);
  const user = await getUserDoc(uid);
  return {
    name: user.name,
    email: user.email,
    accountId: user.accountId,
    sections: user.sections,
    isAdmin: user.isAdmin || false,
  };
});
