import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { users } from '../config/users.js';

const router = express.Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, '../../../../.env');

const isAdmin = (req, res, next) => {
  const allSections = ['providers', 'locations', 'services', 'careers', 'patients', 'news'];
  const hasAll = allSections.every(s => req.user.sections.includes(s));
  if (!hasAll) return res.status(403).json({ error: 'Admin access required' });
  next();
};

const readEnv = () => {
  if (!existsSync(ENV_PATH)) return {};
  const lines = readFileSync(ENV_PATH, 'utf8').split('\n');
  return Object.fromEntries(
    lines
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => {
        const idx = l.indexOf('=');
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
      })
  );
};

const writeEnvKey = (key, value) => {
  let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content = content.trimEnd() + `\n${key}=${value}\n`;
  }
  writeFileSync(ENV_PATH, content, 'utf8');
  process.env[key] = value;
};

// GET /api/settings — returns safe (non-secret) view of current config
router.get('/', isAdmin, (_req, res) => {
  const env = readEnv();
  res.json({
    github: {
      tokenSet: !!env.GITHUB_TOKEN,
      owner: env.GITHUB_OWNER || '',
      repo: env.GITHUB_REPO || '',
    },
    users: users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      sections: u.sections,
      passwordSet: !!env[`${u.id.toUpperCase()}_PASSWORD_HASH`],
    })),
  });
});

// POST /api/settings/github — save GitHub config
router.post('/github', isAdmin, (req, res) => {
  const { token, owner, repo } = req.body;
  if (token) writeEnvKey('GITHUB_TOKEN', token);
  if (owner) writeEnvKey('GITHUB_OWNER', owner);
  if (repo) writeEnvKey('GITHUB_REPO', repo);
  res.json({ success: true });
});

// POST /api/settings/users/:id/password — set a user's password
router.post('/users/:id/password', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const hash = await bcrypt.hash(password, 12);
  const envKey = `${id.toUpperCase()}_PASSWORD_HASH`;
  writeEnvKey(envKey, hash);
  res.json({ success: true });
});

export default router;
