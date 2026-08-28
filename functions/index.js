const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { Octokit } = require('@octokit/rest');
const crypto = require('crypto');

initializeApp();
const db = getFirestore();

function generateRandomPassword() {
  return crypto.randomBytes(9).toString('hex').slice(0, 12);
}

const ALL_SECTIONS = ['providers', 'locations', 'services', 'careers', 'patients', 'news', 'contact'];
const CONTACT_PAGE_PATH = 'src/pages/contact.astro';
const GENERATED_FILE_PREFIXES = ['dist/', 'public_html/', 'client/dist/', '.astro/'];
const EDITABLE_ASTRO_PREFIXES = ['src/pages/', 'src/layouts/'];

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

function computeAffectedCount(before, after) {
  if (Array.isArray(before) && Array.isArray(after)) {
    const beforeIds = new Set(before.map((i) => i?.id).filter(Boolean));
    const afterIds = new Set(after.map((i) => i?.id).filter(Boolean));
    const added = [...afterIds].filter((id) => !beforeIds.has(id)).length;
    const removed = [...beforeIds].filter((id) => !afterIds.has(id)).length;
    const common = [...beforeIds].filter((id) => afterIds.has(id));
    const modified = common.filter((id) => {
      const b = before.find((i) => i?.id === id);
      const a = after.find((i) => i?.id === id);
      return JSON.stringify(b) !== JSON.stringify(a);
    }).length;
    return added + removed + modified;
  }
  return JSON.stringify(before) !== JSON.stringify(after) ? 1 : 0;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function textFromHtml(value) {
  return decodeHtml(String(value ?? '').replace(/<[^>]+>/g, '').trim());
}

function parseContactItem(rawItem) {
  const item = rawItem.trim();
  const anchor = item.match(/^(.*?)(?:\s*)<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>([\s\S]*)$/i);
  if (anchor) {
    const prefix = textFromHtml(anchor[1]).replace(/:\s*$/, '');
    const suffix = textFromHtml(anchor[4]);
    return {
      label: prefix,
      value: `${textFromHtml(anchor[3])}${suffix ? ` ${suffix}` : ''}`.trim(),
      href: decodeHtml(anchor[2]),
    };
  }

  const text = textFromHtml(item);
  const colonIndex = text.indexOf(':');
  if (colonIndex > -1) {
    return {
      label: text.slice(0, colonIndex).trim(),
      value: text.slice(colonIndex + 1).trim(),
      href: '',
    };
  }
  return { label: '', value: text, href: '' };
}

function parseContactPage(content) {
  const cards = [];
  const cardRegex = /<div class="contact-card">([\s\S]*?)<\/div>/g;
  let cardMatch;
  while ((cardMatch = cardRegex.exec(content))) {
    const block = cardMatch[1];
    const title = textFromHtml(block.match(/<h2>([\s\S]*?)<\/h2>/i)?.[1] || '');
    const rows = [];
    const itemRegex = /<li>([\s\S]*?)<\/li>/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(block))) {
      rows.push(parseContactItem(itemMatch[1]));
    }
    cards.push({ title, rows });
  }
  return { cards };
}

function buildContactItem(row) {
  const label = row.label?.trim();
  const value = row.value?.trim();
  const href = sanitizeHref(row.href);
  if (!value) return '';

  const prefix = label ? `${escapeHtml(label)}: ` : '';
  const body = href
    ? `<a href="${escapeHtml(href)}">${escapeHtml(value)}</a>`
    : escapeHtml(value);
  return `            <li>${prefix}${body}</li>`;
}

function sanitizeHref(value) {
  const href = String(value ?? '').trim();
  if (!href) return '';
  if (/^(tel:|mailto:|https?:\/\/|\/|#)/i.test(href)) return href;
  return '';
}

function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueSlug(value, usedSlugs, fallback) {
  const root = slugify(value) || fallback;
  let slug = root;
  let suffix = 2;
  while (usedSlugs.has(slug)) {
    slug = `${root}-${suffix}`;
    suffix += 1;
  }
  usedSlugs.add(slug);
  return slug;
}

function normalizeProvider(item, index, usedSlugs) {
  const provider = { ...(item || {}) };
  const meta = { ...(provider.meta || {}) };
  const firstName = meta['ignyte-provider-fname'] || '';
  const lastName = meta['ignyte-provider-lname'] || '';
  const title = provider.title || [firstName, lastName].filter(Boolean).join(' ') || `Provider ${index + 1}`;

  provider.title = title;
  provider.slug = uniqueSlug(provider.slug || title, usedSlugs, `provider-${index + 1}`);
  provider.url = provider.url || `https://cmcenters.org/health-care-provider/${provider.slug}/`;

  if (!provider.thumbnail && meta.thumbnail) provider.thumbnail = meta.thumbnail;
  delete meta.thumbnail;
  provider.meta = meta;

  return provider;
}

function normalizeSectionItems(section, items) {
  if (!Array.isArray(items)) return items;
  if (section !== 'providers') return items;

  const usedSlugs = new Set();
  return items.map((item, index) => normalizeProvider(item, index, usedSlugs));
}

function validateSectionItems(section, items) {
  if (!Array.isArray(items)) return;
  const routedSections = new Set(['providers', 'locations', 'services', 'posts']);
  if (!routedSections.has(section)) return;

  const missing = [];
  const duplicates = [];
  const seen = new Set();
  items.forEach((item, index) => {
    const label = item?.title || item?.name || item?.id || `item ${index + 1}`;
    const slug = String(item?.slug || '').trim();
    if (!slug) {
      missing.push(label);
      return;
    }
    if (seen.has(slug)) duplicates.push(slug);
    seen.add(slug);
  });

  if (missing.length) {
    throw { code: 400, message: `Missing slug for ${section}: ${missing.slice(0, 5).join(', ')}` };
  }
  if (duplicates.length) {
    throw { code: 400, message: `Duplicate slug for ${section}: ${duplicates.slice(0, 5).join(', ')}` };
  }
}

function normalizeRepoPath(path) {
  return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function isGeneratedPath(path) {
  const normalized = normalizeRepoPath(path);
  return GENERATED_FILE_PREFIXES.some((prefix) => {
    const dir = prefix.replace(/\/$/, '');
    return normalized === dir || normalized.startsWith(prefix);
  });
}

function isSafeRepoPath(path) {
  return normalizeRepoPath(path)
    .split('/')
    .every((part) => part && part !== '.' && part !== '..');
}

function isEditableAstroPath(path) {
  const normalized = normalizeRepoPath(path);
  return isSafeRepoPath(normalized)
    && normalized.endsWith('.astro')
    && EDITABLE_ASTRO_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isEditableStaticHtmlPath(path) {
  const normalized = normalizeRepoPath(path);
  return isSafeRepoPath(normalized) && normalized.endsWith('.html') && !isGeneratedPath(normalized);
}

function isEditablePagePath(path) {
  return isEditableAstroPath(path) || isEditableStaticHtmlPath(path);
}

function getPageFileType(path) {
  return normalizeRepoPath(path).endsWith('.astro') ? 'astro' : 'html';
}

function buildContactPage(data) {
  const cards = Array.isArray(data?.cards) ? data.cards : [];
  const cardMarkup = cards
    .filter((card) => card.title?.trim())
    .map((card) => {
      const rows = Array.isArray(card.rows) ? card.rows.map(buildContactItem).filter(Boolean) : [];
      return `        <!-- ${escapeHtml(card.title)} -->
        <div class="contact-card">
          <h2>${escapeHtml(card.title)}</h2>
          <ul class="contact-list">
${rows.join('\n')}
          </ul>
        </div>`;
    })
    .join('\n\n');

  return `---
import Base from '../layouts/Base.astro';
---
<Base title="Contact Us" description="Contact Community Medical Centers - administration, media inquiries, medical records, patient portal support, and patient relations.">

  <div class="page-header">
    <div class="container">
      <div class="breadcrumb"><a href="/">Home</a> / Contact Us</div>
      <h1>Contact Us</h1>
    </div>
  </div>

  <section class="section">
    <div class="container" style="max-width:860px">
      <div class="contact-grid">

${cardMarkup}

      </div>
    </div>
  </section>

</Base>

<style>
  .contact-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }
  .contact-card {
    background: var(--bg-alt);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.75rem 2rem;
  }
  .contact-card h2 {
    font-size: 1.05rem;
    color: var(--teal-dark);
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .contact-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.95rem;
    color: var(--text);
  }
  .contact-list a {
    color: var(--teal-dark);
    text-decoration: none;
  }
  .contact-list a:hover {
    text-decoration: underline;
  }
  @media (max-width: 640px) {
    .contact-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
`;
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
  const normalizedItems = normalizeSectionItems(section, items);
  validateSectionItems(section, normalizedItems);

  const account = await getAccountDoc(accountId);
  const octokit = new Octokit({ auth: account.githubToken });

  // Fetch current state before overwriting (best-effort for change log)
  let beforeItems = SECTION_DEFAULTS[section] ?? [];
  if (sha) {
    try {
      const { data: current } = await octokit.repos.getContent({
        owner: account.githubOwner,
        repo: account.githubRepo,
        path: `src/data/${section}.json`,
      });
      const text = Buffer.from(current.content, 'base64').toString('utf8').replace(/^﻿/, '');
      beforeItems = JSON.parse(text);
    } catch (_) {}
  }

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: account.githubOwner,
    repo: account.githubRepo,
    path: `src/data/${section}.json`,
    message: `webmin: update ${section}`,
    content: Buffer.from(JSON.stringify(normalizedItems, null, 2)).toString('base64'),
    sha,
  });

  // Record change to Firestore (best-effort — don't fail save if logging fails)
  try {
    await db.collection('accounts').doc(accountId).collection('changes').add({
      timestamp: new Date(),
      section,
      userId: uid,
      userName: user.name || '',
      userEmail: user.email || '',
      beforeItems,
      afterItems: normalizedItems,
      affectedCount: computeAffectedCount(beforeItems, normalizedItems),
      isUndo: false,
    });
  } catch (logErr) {
    console.error('Change log write error:', logErr.message);
  }

  return { ok: true, sha: data.content.sha, items: normalizedItems };
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
    siteUrl: account.siteUrl || '',
    tokenSet: !!account.githubToken,
  };
});

// ── Settings write (admin) ────────────────────────────────────────────────────
exports.saveSettings = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, githubOwner, githubRepo, githubToken, siteUrl } = req.body;

  const user = await getUserDoc(uid);
  if (!user.isAdmin || user.accountId !== accountId) throw { code: 403, message: 'Admins only' };

  const update = { githubOwner, githubRepo };
  if (githubToken) update.githubToken = githubToken;
  if (siteUrl !== undefined) update.siteUrl = siteUrl;

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

// ── Reset user password (admin) ───────────────────────────────────────────────
exports.resetUserPassword = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, targetUid } = req.body;

  const caller = await getUserDoc(uid);
  if (!caller.isAdmin || caller.accountId !== accountId) throw { code: 403, message: 'Admins only' };
  if (targetUid === uid) throw { code: 400, message: 'Cannot reset your own password' };

  const targetUser = await getUserDoc(targetUid);
  if (targetUser.accountId !== accountId) throw { code: 403, message: 'Wrong account' };

  const newPassword = generateRandomPassword();
  await getAuth().updateUser(targetUid, { password: newPassword });

  return { ok: true, newPassword };
});

// ── HTML page editor (admin) ──────────────────────────────────────────────────
exports.getHtmlFiles = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId } = req.body;

  const user = await getUserDoc(uid);
  if (!user.isAdmin || user.accountId !== accountId) throw { code: 403, message: 'Admins only' };

  const account = await getAccountDoc(accountId);
  const octokit = new Octokit({ auth: account.githubToken });

  // Resolve HEAD commit for the default branch
  const { data: repo } = await octokit.repos.get({ owner: account.githubOwner, repo: account.githubRepo });
  const { data: ref } = await octokit.git.getRef({
    owner: account.githubOwner,
    repo: account.githubRepo,
    ref: `heads/${repo.default_branch}`,
  });
  const { data: commit } = await octokit.git.getCommit({
    owner: account.githubOwner,
    repo: account.githubRepo,
    commit_sha: ref.object.sha,
  });

  // Recursively list editable source pages.
  const { data: tree } = await octokit.git.getTree({
    owner: account.githubOwner,
    repo: account.githubRepo,
    tree_sha: commit.tree.sha,
    recursive: '1',
  });

  const files = tree.tree
    .filter((item) => item.type === 'blob' && isEditablePagePath(item.path))
    .map((item) => ({ path: item.path, size: item.size, type: getPageFileType(item.path) }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return { files };
});

exports.getHtmlFile = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, path } = req.body;
  const normalizedPath = normalizeRepoPath(path);

  if (!isEditablePagePath(normalizedPath)) throw { code: 400, message: 'Invalid editable page path' };

  const user = await getUserDoc(uid);
  if (!user.isAdmin || user.accountId !== accountId) throw { code: 403, message: 'Admins only' };

  const account = await getAccountDoc(accountId);
  const octokit = new Octokit({ auth: account.githubToken });

  const { data } = await octokit.repos.getContent({
    owner: account.githubOwner,
    repo: account.githubRepo,
    path: normalizedPath,
  });

  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { content, sha: data.sha, path: normalizedPath, type: getPageFileType(normalizedPath) };
});

exports.saveHtmlFile = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, path, content, sha } = req.body;
  const normalizedPath = normalizeRepoPath(path);

  if (!isEditablePagePath(normalizedPath)) throw { code: 400, message: 'Invalid editable page path' };

  const user = await getUserDoc(uid);
  if (!user.isAdmin || user.accountId !== accountId) throw { code: 403, message: 'Admins only' };

  const account = await getAccountDoc(accountId);
  const octokit = new Octokit({ auth: account.githubToken });

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: account.githubOwner,
    repo: account.githubRepo,
    path: normalizedPath,
    message: `webmin: update ${normalizedPath}`,
    content: Buffer.from(content, 'utf8').toString('base64'),
    sha,
  });

  return { ok: true, sha: data.content.sha };
});

// ── Contact page editor ───────────────────────────────────────────────────────
exports.getContactPage = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId } = req.body;

  const user = await getUserDoc(uid);
  if (user.accountId !== accountId) throw { code: 403, message: 'Wrong account' };
  if (!user.isAdmin && !canAccess(user.sections, 'contact')) throw { code: 403, message: 'Access denied' };

  const account = await getAccountDoc(accountId);
  const octokit = new Octokit({ auth: account.githubToken });

  const { data } = await octokit.repos.getContent({
    owner: account.githubOwner,
    repo: account.githubRepo,
    path: CONTACT_PAGE_PATH,
  });

  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { items: parseContactPage(content), sha: data.sha, path: CONTACT_PAGE_PATH };
});

exports.saveContactPage = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, items, sha } = req.body;

  const user = await getUserDoc(uid);
  if (user.accountId !== accountId) throw { code: 403, message: 'Wrong account' };
  if (!user.isAdmin && !canAccess(user.sections, 'contact')) throw { code: 403, message: 'Access denied' };

  const account = await getAccountDoc(accountId);
  const octokit = new Octokit({ auth: account.githubToken });

  let beforeItems = { cards: [] };
  try {
    const { data: current } = await octokit.repos.getContent({
      owner: account.githubOwner,
      repo: account.githubRepo,
      path: CONTACT_PAGE_PATH,
    });
    const currentContent = Buffer.from(current.content, 'base64').toString('utf8');
    beforeItems = parseContactPage(currentContent);
  } catch (_) {}

  const content = buildContactPage(items);
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: account.githubOwner,
    repo: account.githubRepo,
    path: CONTACT_PAGE_PATH,
    message: 'webmin: update contact page',
    content: Buffer.from(content, 'utf8').toString('base64'),
    sha,
  });

  try {
    await db.collection('accounts').doc(accountId).collection('changes').add({
      timestamp: new Date(),
      section: 'contact',
      userId: uid,
      userName: user.name || '',
      userEmail: user.email || '',
      beforeItems,
      afterItems: items,
      affectedCount: computeAffectedCount(beforeItems, items),
      isUndo: false,
    });
  } catch (logErr) {
    console.error('Change log write error:', logErr.message);
  }

  return { ok: true, sha: data.content.sha, items };
});

// ── Change history ────────────────────────────────────────────────────────────
exports.getChangeHistory = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, section, limit = 50 } = req.body;

  const user = await getUserDoc(uid);
  if (user.accountId !== accountId) throw { code: 403, message: 'Wrong account' };

  // Non-admins see only their own changes; admins see all
  let query = db.collection('accounts').doc(accountId).collection('changes');
  if (user.isAdmin) {
    query = query.orderBy('timestamp', 'desc').limit(200);
  } else {
    query = query.where('userId', '==', uid).orderBy('timestamp', 'desc').limit(200);
  }

  const snap = await query.get();
  let changes = snap.docs.map((d) => ({
    id: d.id,
    timestamp: d.data().timestamp?.toDate?.()?.toISOString() ?? null,
    section: d.data().section,
    userId: d.data().userId,
    userName: d.data().userName,
    userEmail: d.data().userEmail,
    affectedCount: d.data().affectedCount,
    isUndo: d.data().isUndo || false,
  }));

  if (section) changes = changes.filter((c) => c.section === section);
  return { changes: changes.slice(0, Math.min(limit, 100)) };
});

exports.getChangeDetail = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, changeId } = req.body;

  const user = await getUserDoc(uid);
  if (user.accountId !== accountId) throw { code: 403, message: 'Wrong account' };

  const snap = await db.collection('accounts').doc(accountId).collection('changes').doc(changeId).get();
  if (!snap.exists) throw { code: 404, message: 'Change not found' };

  const d = snap.data();
  if (!user.isAdmin && d.userId !== uid) throw { code: 403, message: 'Access denied' };

  return {
    id: snap.id,
    timestamp: d.timestamp?.toDate?.()?.toISOString() ?? null,
    section: d.section,
    userId: d.userId,
    userName: d.userName,
    userEmail: d.userEmail,
    affectedCount: d.affectedCount,
    isUndo: d.isUndo || false,
    beforeItems: d.beforeItems,
    afterItems: d.afterItems,
  };
});

exports.undoChange = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, changeId } = req.body;

  const user = await getUserDoc(uid);
  if (user.accountId !== accountId) throw { code: 403, message: 'Wrong account' };

  const snap = await db.collection('accounts').doc(accountId).collection('changes').doc(changeId).get();
  if (!snap.exists) throw { code: 404, message: 'Change not found' };

  const changeData = snap.data();
  if (!user.isAdmin && changeData.userId !== uid) throw { code: 403, message: 'Access denied' };

  const { section } = changeData;
  if (!user.isAdmin && !canAccess(user.sections, section)) throw { code: 403, message: 'Access denied' };

  const account = await getAccountDoc(accountId);
  const octokit = new Octokit({ auth: account.githubToken });

  if (section === 'contact') {
    const revertTo = changeData.beforeItems;
    let currentSha = null;
    try {
      const { data: current } = await octokit.repos.getContent({
        owner: account.githubOwner,
        repo: account.githubRepo,
        path: CONTACT_PAGE_PATH,
      });
      currentSha = current.sha;
    } catch (err) {
      if (err.status !== 404) throw err;
    }

    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner: account.githubOwner,
      repo: account.githubRepo,
      path: CONTACT_PAGE_PATH,
      message: 'webmin: undo change to contact page',
      content: Buffer.from(buildContactPage(revertTo), 'utf8').toString('base64'),
      sha: currentSha || undefined,
    });

    try {
      await db.collection('accounts').doc(accountId).collection('changes').add({
        timestamp: new Date(),
        section,
        userId: uid,
        userName: user.name || '',
        userEmail: user.email || '',
        beforeItems: changeData.afterItems,
        afterItems: revertTo,
        affectedCount: computeAffectedCount(changeData.afterItems, revertTo),
        isUndo: true,
        undoOf: changeId,
      });
    } catch (logErr) {
      console.error('Change log write error:', logErr.message);
    }

    return { ok: true, sha: data.content.sha, items: revertTo };
  }

  // Fetch current SHA (server-side — caller doesn't need to pass it)
  let currentSha = null;
  try {
    const { data: current } = await octokit.repos.getContent({
      owner: account.githubOwner,
      repo: account.githubRepo,
      path: `src/data/${section}.json`,
    });
    currentSha = current.sha;
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  const revertTo = changeData.beforeItems;
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: account.githubOwner,
    repo: account.githubRepo,
    path: `src/data/${section}.json`,
    message: `webmin: undo change to ${section}`,
    content: Buffer.from(JSON.stringify(revertTo, null, 2)).toString('base64'),
    sha: currentSha,
  });

  try {
    await db.collection('accounts').doc(accountId).collection('changes').add({
      timestamp: new Date(),
      section,
      userId: uid,
      userName: user.name || '',
      userEmail: user.email || '',
      beforeItems: changeData.afterItems,
      afterItems: revertTo,
      affectedCount: computeAffectedCount(changeData.afterItems, revertTo),
      isUndo: true,
      undoOf: changeId,
    });
  } catch (logErr) {
    console.error('Change log write error:', logErr.message);
  }

  return { ok: true, sha: data.content.sha, items: revertTo };
});

// ── Send password reset email (admin) ─────────────────────────────────────────
exports.sendPasswordEmail = route(async (req) => {
  const { uid } = await verifyAuth(req);
  const { accountId, targetUid, newPassword, siteUrl } = req.body;

  const caller = await getUserDoc(uid);
  if (!caller.isAdmin || caller.accountId !== accountId) throw { code: 403, message: 'Admins only' };

  const targetUser = await getUserDoc(targetUid);
  if (targetUser.accountId !== accountId) throw { code: 403, message: 'Wrong account' };

  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) throw { code: 500, message: 'Email service not configured' };

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@webmin.io';
  const emailSubject = 'Your temporary password for Webmin';
  const emailHtml = `
    <p>Hi ${targetUser.name},</p>
    <p>Your password has been reset by an administrator.</p>
    <p><strong>Temporary Password:</strong> <code>${newPassword}</code></p>
    <p><a href="${siteUrl}/login">Log in to Webmin</a></p>
    <p>You will be prompted to change your password on first login.</p>
    <p>If you did not request this, please contact your administrator.</p>
  `;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Webmin', email: senderEmail },
        to: [{ email: targetUser.email, name: targetUser.name }],
        subject: emailSubject,
        htmlContent: emailHtml,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Brevo API error:', response.status, errorData);
      throw { code: 500, message: `Email service error: ${response.statusText}` };
    }

    return { ok: true, messageSent: true };
  } catch (err) {
    if (err.code) throw err;
    console.error('Email send error:', err.message);
    throw { code: 500, message: `Failed to send email: ${err.message}` };
  }
});
