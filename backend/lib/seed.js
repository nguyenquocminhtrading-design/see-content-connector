// Seed the PostgreSQL database with the demo dataset (run: npm run seed).
// Useful after starting Postgres via docker-compose to get instant data.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config();

const { initDatabase, pool } = require('./db');
const demo = require('./demo');

async function seed() {
  const ready = await initDatabase();
  if (!ready) {
    console.error('PostgreSQL is not available. Start it first:  docker compose up -d postgres redis');
    process.exit(1);
  }
  const d = demo.getDemo();
  for (const c of d.connections) {
    await pool.query(
      `INSERT INTO platform_connection (id, platform, status, token_expires_at, created_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (platform) DO UPDATE SET status = EXCLUDED.status`,
      [c.id, c.platform, c.status, c.tokenExpiresAt, c.createdAt]
    );
  }
  for (const a of d.assets) {
    const { rows } = await pool.query(
      `INSERT INTO asset (connection_id, platform, platform_post_id, type, title, thumbnail_url, status, is_flagged, completion_rate, published_at, synced_at)
       VALUES ((SELECT id FROM platform_connection WHERE platform = $2), $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
       ON CONFLICT (platform, platform_post_id) DO UPDATE SET title = EXCLUDED.title
       RETURNING id`,
      [a.connectionId, a.platform, a.platformPostId, a.type, a.title, a.thumbnailUrl, a.status, a.isFlagged, a.completionRate, a.publishedAt]
    );
    const assetId = rows[0].id;
    for (const h of a.history) {
      await pool.query(
        `INSERT INTO metrics (asset_id, reach, impressions, likes, comments, shares, completion_rate, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz)`,
        [assetId, h.reach, h.impressions, h.likes, h.comments, h.shares, a.completionRate, `${h.date} 12:00:00+00`]
      );
    }
  }
  for (const al of d.alerts) {
    await pool.query(
      `INSERT INTO alert (id, type, severity, message, is_read, created_at) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO NOTHING`,
      [al.id, al.type, al.severity, al.message, al.isRead, al.createdAt]
    );
  }
  console.log('Seed complete: connections, assets, metrics history and alerts inserted.');
  await pool.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });
