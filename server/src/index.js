import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import authRoutes from './routes/auth.js';
import githubRoutes from './routes/github.js';
import settingsRoutes from './routes/settings.js';
import { verifyToken } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_DIST = resolve(__dirname, '../../client/dist');
const isDev = !existsSync(CLIENT_DIST);

if (isDev) {
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
}

app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/github', verifyToken, githubRoutes);
app.use('/api/settings', verifyToken, settingsRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

if (!isDev) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (_req, res) => res.sendFile(resolve(CLIENT_DIST, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Webmin running on http://localhost:${PORT}${isDev ? ' (dev — client on :5173)' : ''}`);
});
