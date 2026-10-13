import 'dotenv/config';
import { createApp } from './app.js';
import { initializeDatabase, pool } from './db.js';

const port = Number(process.env.PORT) || 3001;

try {
  await initializeDatabase();
  createApp(pool).listen(port, () => console.log(`Ticket API listening on http://localhost:${port}`));
} catch (error) {
  console.error('Could not start the ticket API:', error.message);
  process.exitCode = 1;
}
