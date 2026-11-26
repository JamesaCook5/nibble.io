'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
function loadLocalEnv() {
  try {
    for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] == null) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch {}
}

async function main() {
  loadLocalEnv();
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('No DATABASE_URL configured; skipping database migrations.');
    return;
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString, connectionTimeoutMillis:15000 });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS nibble_schema_migrations (
      migration_name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

    const directory = path.join(root, 'migrations');
    const files = fs.readdirSync(directory).filter(name => /^\d+_[\w-]+\.sql$/.test(name)).sort();
    for (const name of files) {
      const sql = fs.readFileSync(path.join(directory, name), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const result = await client.query('SELECT checksum FROM nibble_schema_migrations WHERE migration_name = $1', [name]);
      if (result.rows.length) {
        if (result.rows[0].checksum !== checksum) throw new Error(`Applied migration ${name} was modified; add a new migration instead.`);
        console.log(`Already applied: ${name}`);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO nibble_schema_migrations (migration_name, checksum) VALUES ($1, $2)', [name, checksum]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      console.log(`Applied: ${name}`);
    }
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
});
