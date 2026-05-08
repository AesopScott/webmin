import express from 'express';
import bcrypt from 'bcryptjs';
import { users } from '../config/users.js';
import { readEnv, writeEnv } from '../lib/env.js';

const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
};

// GET /api/settings
router.get('/', requireAdmin, (_req, res) => {
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

// POST /api/settings/github
router.post('/github', requireAdmin, (req, res) => {
  const { token, owner, repo } = req.body;
  const updates = {};
  if (token) updates.GITHUB_TOKEN = token;
  if (owner) updates.GITHUB_OWNER = owner;
  if (repo) updates.GITHUB_REPO = repo;
  writeEnv(updates);
  res.json({ success: true });
});

// POST /api/settings/users/:id/password
router.post('/users/:id/password', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const hash = await bcrypt.hash(password, 12);
  writeEnv({ [`${id.toUpperCase()}_PASSWORD_HASH`]: hash });
  res.json({ success: true });
});

export default router;
