// PostgreSQL layer. If the DB is unreachable the API keeps running in DEMO mode
// (in-memory data) so the project can be verified end-to-end with zero setup.
const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
      max: 10,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'see_content_connector',
      connectionTimeoutMillis: 1500,
      max: 10,
    };

const pool = new Pool(poolConfig);

let dbReady = false;

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_connection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspace(id),
  platform TEXT NOT NULL CHECK (platform IN ('facebook','instagram','linkedin','tiktok')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected','expired','error','disconnected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_connection_platform
  ON platform_connection (platform);

CREATE TABLE IF NOT EXISTS asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES platform_connection(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook','instagram','linkedin','tiktok')),
  platform_post_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('video','reel','photo','carousel','story','text')),
  title TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published','scheduled','draft','failed','removed','processing','live','error')),
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  completion_rate REAL,
  published_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, platform_post_id)
);
CREATE INDEX IF NOT EXISTS idx_asset_platform ON asset (platform);
CREATE INDEX IF NOT EXISTS idx_asset_status ON asset (status);

CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES asset(id) ON DELETE CASCADE,
  reach INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  completion_rate REAL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_metrics_asset ON metrics (asset_id, recorded_at);

CREATE TABLE IF NOT EXISTS alert (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function initDatabase() {
  try {
    await pool.query('SELECT 1');
    await pool.query(SCHEMA);
    dbReady = true;
    console.log('[db] PostgreSQL connected — schema ready');
  } catch (err) {
    dbReady = false;
    console.warn('[db] PostgreSQL unavailable — running in DEMO mode (in-memory data):', err.message);
  }
  return dbReady;
}

function isDbReady() {
  return dbReady;
}

async function q(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, initDatabase, isDbReady, q };
