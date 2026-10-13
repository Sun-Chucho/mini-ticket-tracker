import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function initializeDatabase(database = pool) {
  const schemaPath = new URL('./schema.sql', import.meta.url);
  const schema = await readFile(fileURLToPath(schemaPath), 'utf8');
  await database.query(schema);
}
