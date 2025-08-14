require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files so HTML pages work in Codespaces
app.use(express.static(path.join(__dirname)));
app.use(express.json());

const {
  GITHUB_TOKEN,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH
} = process.env;

const baseUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`;

async function listProformaFiles() {
  const url = `${baseUrl}/data/proformas?ref=${GITHUB_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'User-Agent': 'proforma-app',
      Accept: 'application/vnd.github.v3+json'
    }
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function getFileContent(item) {
  const res = await fetch(`${item.url}?ref=${GITHUB_BRANCH}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'User-Agent': 'proforma-app',
      Accept: 'application/vnd.github.v3+json'
    }
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return JSON.parse(Buffer.from(json.content, json.encoding).toString());
}

app.post('/proformas', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.pino || !payload.createdAt) {
      return res.status(400).json({ error: 'Missing pino or createdAt' });
    }
    const createdSan = payload.createdAt.replace(/[^0-9A-Za-z]/g, '');
    const prefix = `${payload.pino}--${createdSan}`;
    const files = await listProformaFiles();
    const names = files.map(f => f.name);
    let name = `${prefix}.json`;
    let version = 1;
    while (names.includes(name)) {
      version += 1;
      name = `${prefix}-v${version}.json`;
    }
    const filePath = `data/proformas/${name}`;
    const content = Buffer.from(JSON.stringify(payload, null, 2)).toString('base64');
    const putRes = await fetch(`${baseUrl}/${filePath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'proforma-app',
        Accept: 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: `Save proforma ${payload.pino}`,
        content,
        branch: GITHUB_BRANCH
      })
    });
    if (!putRes.ok) {
      return res.status(500).json({ error: 'Failed to save proforma' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/proformas', async (req, res) => {
  try {
    const files = await listProformaFiles();
    const summaries = [];
    for (const f of files) {
      if (f.type !== 'file') continue;
      const data = await getFileContent(f);
      summaries.push({
        pino: data.pino,
        companyName: data.companyName,
        date: data.date,
        createdAt: data.createdAt,
        grandTotal: data.totals?.grandTotal
      });
    }
    summaries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(summaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/proformas/:pino', async (req, res) => {
  try {
    const pino = req.params.pino;
    const files = await listProformaFiles();
    const matches = [];
    for (const f of files) {
      if (f.type === 'file' && f.name.startsWith(`${pino}--`)) {
        const data = await getFileContent(f);
        matches.push(data);
      }
    }
    if (!matches.length) {
      return res.status(404).json({ error: 'Not found' });
    }
    matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(matches[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

