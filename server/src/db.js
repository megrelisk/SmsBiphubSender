import { readFileSync } from 'node:fs';
import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export const query = (text, params) => pool.query(text, params);

export async function migrate() {
  const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
}
