import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const {
  GITHUB_TOKEN,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH = 'main'
} = process.env;

const BASE_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

function ghHeaders() {
  return {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'proforma-app'
  };
}

app.post('/proformas', async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.pino || !data.createdAt) {
      return res.status(400).json({ error: 'Missing pino or createdAt' });
    }
    const isoSanitized = data.createdAt.replace(/:/g, '-');
    const basePath = `data/proformas/${data.pino}--${isoSanitized}`;
    let path = `${basePath}.json`;
    let version = 1;
    // check if file exists, increment version
    while (true) {
      const resp = await fetch(`${BASE_URL}/contents/${path}?ref=${GITHUB_BRANCH}`, { headers: ghHeaders() });
      if (resp.status === 404) break;
      version += 1;
      path = `${basePath}-v${version}.json`;
    }
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const putResp = await fetch(`${BASE_URL}/contents/${path}`, {
      method: 'PUT',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Add proforma ${data.pino}`,
        content,
        branch: GITHUB_BRANCH
      })
    });
    const result = await putResp.json();
    if (!putResp.ok) {
      return res.status(500).json({ error: result?.message || 'GitHub API error' });
    }
    res.json({ ok: true, path: result.content.path, sha: result.content.sha });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

app.get('/proformas', async (req, res) => {
  try {
    const dirResp = await fetch(`${BASE_URL}/contents/data/proformas?ref=${GITHUB_BRANCH}`, { headers: ghHeaders() });
    if (dirResp.status === 404) return res.json([]);
    const files = await dirResp.json();
    const items = [];
    for (const file of files) {
      if (file.type !== 'file') continue;
      const fileResp = await fetch(file.download_url);
      const json = await fileResp.json();
      items.push({
        pino: json.pino,
        companyName: json.companyName,
        date: json.date,
        createdAt: json.createdAt,
        grandTotal: json?.totals?.grandTotal,
        path: file.path
      });
    }
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list' });
  }
});

app.get('/proformas/:pino', async (req, res) => {
  try {
    const pino = req.params.pino;
    const dirResp = await fetch(`${BASE_URL}/contents/data/proformas?ref=${GITHUB_BRANCH}`, { headers: ghHeaders() });
    if (dirResp.status === 404) return res.status(404).json({ error: 'Not found' });
    const files = await dirResp.json();
    const matches = files
      .filter(f => f.name.startsWith(`${pino}--`))
      .sort((a, b) => new Date(b.name.split('--')[1].replace(/-v\d+\.json$/, '')) - new Date(a.name.split('--')[1].replace(/-v\d+\.json$/, '')));
    if (matches.length === 0) return res.status(404).json({ error: 'Not found' });
    const fileResp = await fetch(matches[0].download_url);
    const json = await fileResp.json();
    res.json(json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
