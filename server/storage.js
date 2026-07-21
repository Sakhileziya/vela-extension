import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storagePath = path.join(__dirname, '..', 'data', 'pilot-events.jsonl');
const databaseUrl = process.env.DATABASE_URL;
let pool = null;
let dbReady = false;

async function ensureDatabase() {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl });
  }
  if (!dbReady) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id BIGSERIAL PRIMARY KEY,
        event_type TEXT,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    dbReady = true;
  }
  return pool;
}

async function ensureFile() {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  try {
    await fs.access(storagePath);
  } catch {
    await fs.writeFile(storagePath, '', 'utf8');
  }
}

export async function appendEvent(event) {
  await ensureFile();
  const record = { ...event, createdAt: new Date().toISOString() };
  const line = `${JSON.stringify(record)}\n`;

  try {
    const db = await ensureDatabase();
    if (db) {
      await db.query('INSERT INTO events (event_type, payload, created_at) VALUES ($1, $2, $3)', [record.type || 'event', record, record.createdAt]);
    }
  } catch (err) {
    console.warn('Database persistence unavailable, using file fallback:', err.message);
  }

  try {
    await fs.appendFile(storagePath, line, 'utf8');
    return record;
  } catch (err) {
    console.error('appendEvent error', err);
    throw err;
  }
}

export async function readEvents() {
  await ensureFile();
  try {
    const db = await ensureDatabase();
    if (db) {
      const result = await db.query('SELECT event_type, payload, created_at FROM events ORDER BY id DESC LIMIT 1000');
      return result.rows.map((row) => ({
        ...row.payload,
        createdAt: row.payload?.createdAt || row.created_at,
        type: row.payload?.type || row.event_type,
      }));
    }
  } catch (err) {
    console.warn('Database read failed, using file fallback:', err.message);
  }

  try {
    const content = await fs.readFile(storagePath, 'utf8');
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    console.error('readEvents error', err);
    return [];
  }
}

export async function streamEvents(onEvent) {
  await ensureFile();
  const stream = fsSync.createReadStream(storagePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    try {
      onEvent(JSON.parse(line));
    } catch {
      // ignore parse errors for individual lines
    }
  }
}
