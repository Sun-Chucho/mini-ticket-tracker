import 'dotenv/config';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { initializeDatabase, pool } from './db.js';

const port = Number(process.env.PORT) || 3001;
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const staticDirectory = resolve(projectRoot, 'dist');

try {
  await initializeDatabase();
  const app = createApp(pool, { staticDirectory: existsSync(staticDirectory) ? staticDirectory : undefined });
  const server = app.listen(port, () => console.log(`Ticket app listening on http://localhost:${port}`));

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(() => pool.end().finally(() => process.exit(0)));
    });
  }
} catch (error) {
  console.error('Could not start the ticket API:', error.message);
  process.exitCode = 1;
}
