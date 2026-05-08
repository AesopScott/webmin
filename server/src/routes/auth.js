import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { users, getUserSections, getPasswordHash } from '../config/users.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  const hash = user ? getPasswordHash(user.id) : null;

  if (!user || !hash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const sections = getUserSections(user);
  const isAdmin = user.sections.includes('*');
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, sections, isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, sections, isAdmin },
  });
});

export default router;
