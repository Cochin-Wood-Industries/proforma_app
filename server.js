const express = require('express');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', async (req, res) => {
  res.send('Proforma app server running');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
