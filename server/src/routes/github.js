import express from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Octokit } from '@octokit/rest';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../fixtures');

const SECTION_FILES = {
  providers: 'src/data/providers.json',
  locations: 'src/data/locations.json',
  services: 'src/data/services.json',
  news: 'src/data/posts.json',
  faqs: 'src/data/faqs.json',
};

const isMock = () => process.env.USE_MOCK_DATA === 'true';

const canAccess = (user, section) => user.sections.includes(section);

router.get('/:section', async (req, res) => {
  const { section } = req.params;
  if (!canAccess(req.user, section)) return res.status(403).json({ error: 'Access denied' });
  if (!SECTION_FILES[section]) return res.status(404).json({ error: `Section "${section}" has no backing file` });

  if (isMock()) {
    try {
      const content = JSON.parse(readFileSync(resolve(FIXTURES_DIR, `${section}.json`), 'utf-8'));
      return res.json({ content, sha: 'mock-sha' });
    } catch {
      return res.status(404).json({ error: `No fixture file for "${section}"` });
    }
  }

  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const { data } = await octokit.repos.getContent({
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      path: SECTION_FILES[section],
    });
    const content = JSON.parse(Buffer.from(data.content, 'base64').toString());
    res.json({ content, sha: data.sha });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:section', async (req, res) => {
  const { section } = req.params;
  if (!canAccess(req.user, section)) return res.status(403).json({ error: 'Access denied' });
  if (!SECTION_FILES[section]) return res.status(404).json({ error: `Section "${section}" has no backing file` });

  const { content, sha } = req.body;

  if (isMock()) {
    writeFileSync(resolve(FIXTURES_DIR, `${section}.json`), JSON.stringify(content, null, 2));
    return res.json({ success: true });
  }

  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    await octokit.repos.createOrUpdateFileContents({
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      path: SECTION_FILES[section],
      message: `update(${section}): edited via Webmin by ${req.user.name}`,
      content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
      sha,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
