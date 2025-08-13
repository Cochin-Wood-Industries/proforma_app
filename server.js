const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'proformas');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

app.post('/api/proforma', (req, res) => {
  const data = req.body || {};
  const invoiceNumber = (data.invoiceNumber || 'UNKNOWN').replace(/[^A-Za-z0-9-]/g, '');
  const createdAt = new Date().toISOString();
  data.createdAt = createdAt;
  const isoName = createdAt.split('.')[0].replace(/:/g, '-') + 'Z';
  const filename = `${invoiceNumber}--${isoName}.json`;
  fs.writeFile(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), err => {
    if (err) {
      console.error('Failed to save file', err);
      return res.status(500).json({ error: 'Failed to save' });
    }
    res.json({ ok: true, file: filename });
  });
});

app.get('/api/proformas', (req, res) => {
  fs.readdir(DATA_DIR, (err, files) => {
    if (err) return res.json([]);
    const list = files.filter(f => f.endsWith('.json')).map(f => {
      try {
        const content = fs.readFileSync(path.join(DATA_DIR, f), 'utf8');
        const data = JSON.parse(content);
        return {
          file: f,
          invoiceNumber: data.invoiceNumber,
          customerName: data.clientName,
          createdAt: data.createdAt,
          template: data.template || 'cwi'
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(list);
  });
});

app.get('/api/proforma/:file', (req, res) => {
  const filePath = path.join(DATA_DIR, req.params.file);
  fs.readFile(filePath, (err, data) => {
    if (err) return res.status(404).send('Not found');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  });
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
