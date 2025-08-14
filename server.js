const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const {
  GITHUB_TOKEN,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH,
} = process.env;

if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !GITHUB_BRANCH) {
  console.warn('Missing one or more GitHub env vars: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH');
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

const apiBase = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`;
const authHeaders = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
};

function sanitizeDate(str) {
  return str.replace(/[^0-9A-Za-z]/g, '');
}

async function listProformaFiles() {
  const url = `${apiBase}/data/proformas?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const res = await fetch(url, { headers: authHeaders });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub list error: ${res.status}`);
  return res.json();
}

async function getFileContent(name) {
  const url = `${apiBase}/data/proformas/${name}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const res = await fetch(url, { headers: authHeaders });
  if (!res.ok) throw new Error(`GitHub read error: ${res.status}`);
  const data = await res.json();
  const buff = Buffer.from(data.content, data.encoding);
  return JSON.parse(buff.toString('utf8'));
}

app.post('/proformas', async (req, res) => {
  try {
    const proforma = req.body;
    const { pino, createdAt } = proforma;
    if (!pino || !createdAt) {
      return res.status(400).json({ error: 'pino and createdAt required' });
    }
    const sanitized = sanitizeDate(createdAt);
    const baseName = `${pino}--${sanitized}`;

    const files = await listProformaFiles();
    let fileName = `${baseName}.json`;
    let version = 1;
    const matches = files.filter(f => f.name.startsWith(baseName));
    if (matches.length) {
      version = matches.length + 1;
      fileName = `${baseName}-v${version}.json`;
    }

    const content = Buffer.from(JSON.stringify(proforma, null, 2)).toString('base64');
    const url = `${apiBase}/data/proformas/${fileName}`;
    const ghRes = await fetch(url, {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Add proforma ${pino}`,
        content,
        branch: GITHUB_BRANCH,
      }),
    });
    if (!ghRes.ok) {
      const err = await ghRes.text();
      return res.status(500).json({ error: 'GitHub commit failed', details: err });
    }
    const data = await ghRes.json();
    res.status(201).json({ path: data.content.path, sha: data.content.sha });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/proformas', async (req, res) => {
  try {
    const files = await listProformaFiles();
    const result = [];
    for (const file of files) {
      if (file.type !== 'file') continue;
      try {
        const data = await getFileContent(file.name);
        result.push({
          pino: data.pino,
          companyName: data.companyName || data.customer?.name,
          date: data.date,
          createdAt: data.createdAt,
          grandTotal: data.totals?.grandTotal,
        });
      } catch {}
    }
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/proformas/:pino', async (req, res) => {
  const { pino } = req.params;
  try {
    const files = await listProformaFiles();
    const matching = files.filter(f => f.name.startsWith(`${pino}--`));
    if (!matching.length) {
      return res.status(404).json({ error: 'Not found' });
    }
    const proformas = [];
    for (const file of matching) {
      try {
        const data = await getFileContent(file.name);
        proformas.push(data);
      } catch {}
    }
    if (!proformas.length) {
      return res.status(404).json({ error: 'Not found' });
    }
    proformas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(proformas[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


