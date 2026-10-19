// Entry point — SEE Content Connector backend.
// Boots Express, initializes PostgreSQL (falls back to DEMO mode), Redis cache
// (falls back to in-memory), mounts all API routes and the cron sync worker.
const path = require('path');

// Load root .env first (user fills this in), then backend/.env if present.
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
require('dotenv').config({ override: true });

const express = require('express');
const { initDatabase } = require('./lib/db');
const { initCache } = require('./lib/cache');
const routes = require('./lib/routes');
const { startSyncWorker } = require('./lib/sync');

const app = express();
// NOTE: port 3000 is often taken by other local apps — default to 4000.
const PORT = Number(process.env.PORT || 4000);

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api', routes);

app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.originalUrl }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[api] error:', err.message);
  res.status(500).json({ error: err.message || 'Internal error' });
});

async function boot() {
  await initDatabase();
  await initCache();
  // Start background sync worker
  startSyncWorker();
  app.listen(PORT, () => {
    const mode = require('./lib/store').demoMode() ? 'DEMO (in-memory, no PostgreSQL)' : 'PostgreSQL';
    console.log('==============================================');
    console.log('  SEE Content Connector backend');
    console.log(`  http://localhost:${PORT}/api/health`);
    console.log(`  mode: ${mode}`);
    console.log('==============================================');
  });
}

boot();
