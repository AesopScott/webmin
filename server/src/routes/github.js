import express from 'express';
import { Octokit } from '@octokit/rest';

const router = express.Router();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;

const SECTION_FILES = {
  providers: 'src/data/providers.json',
  locations: 'src/data/locations.json',
  services: 'src/data/services.json',
  careers: null, // stored in Astro page — handled separately
  patients: null, // static pages — handled separately
  news: 'src/data/posts.json',
  taxonomies: 'src/data/taxonomies.json',
  faqs: 'src/data/faqs.json',
};

const canAccess = (user, section) =>
  user.sections.includes(section);

router.get('/:section', async (req, res) => {
  const { section } = req.params;
  if (!canAccess(req.user, section)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const filePath = SECTION_FILES[section];
  if (!filePath) {
    return res.status(404).json({ error: `Section "${section}" has no backing file` });
  }

  try {
    const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: filePath });
    const content = JSON.parse(Buffer.from(data.content, 'base64').toString());
    res.json({ content, sha: data.sha });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:section', async (req, res) => {
  const { section } = req.params;
  if (!canAccess(req.user, section)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { content, sha } = req.body;
  const filePath = SECTION_FILES[section];
  if (!filePath) {
    return res.status(404).json({ error: `Section "${section}" has no backing file` });
  }

  try {
    await octokit.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path: filePath,
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
