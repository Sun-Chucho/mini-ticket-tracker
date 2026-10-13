import express from 'express';
import cors from 'cors';

const statuses = ['open', 'in_progress', 'closed'];
const priorities = ['low', 'medium', 'high'];

function parseInteger(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return Number.NaN;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

export function createApp(database, { staticDirectory } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', async (request, response) => {
    try {
      await database.query('SELECT 1');
      response.json({ status: 'ok' });
    } catch {
      response.status(503).json({ status: 'error', error: 'Database is unavailable.' });
    }
  });

  app.get('/tickets/stats', async (request, response, next) => {
    try {
      const result = await database.query(
        `SELECT status, COUNT(*)::int AS count FROM tickets GROUP BY status`,
      );
      const stats = Object.fromEntries(statuses.map((status) => [status, 0]));
      for (const row of result.rows) stats[row.status] = row.count;
      response.json(stats);
    } catch (error) {
      next(error);
    }
  });

  app.get('/tickets', async (request, response, next) => {
    try {
      const { status } = request.query;
      const page = parseInteger(request.query.page ?? '1');
      const limit = parseInteger(request.query.limit ?? '20');
      if (status !== undefined && !statuses.includes(status)) {
        return response.status(400).json({ error: 'Status must be open, in_progress, or closed.' });
      }
      const offset = (page - 1) * limit;
      if (page < 1 || limit < 1 || limit > 100 || !Number.isSafeInteger(offset)) {
        return response.status(400).json({ error: 'Page must be positive and limit must be between 1 and 100.' });
      }
      const values = status ? [status, limit, offset] : [limit, offset];
      const where = status ? 'WHERE status = $1' : '';
      const limitParam = status ? '$2' : '$1';
      const offsetParam = status ? '$3' : '$2';
      const [tickets, total] = await Promise.all([
        database.query(
          `SELECT id, title, description, status, priority, created_at FROM tickets ${where} ORDER BY created_at DESC, id DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
          values,
        ),
        database.query(`SELECT COUNT(*)::int AS count FROM tickets ${where}`, status ? [status] : []),
      ]);
      response.json({ tickets: tickets.rows, page, limit, total: total.rows[0].count });
    } catch (error) {
      next(error);
    }
  });

  app.post('/tickets', async (request, response, next) => {
    try {
      const { title, description = '', priority = 'medium' } = request.body ?? {};
      if (typeof title !== 'string' || title.trim().length === 0 || title.trim().length > 160) {
        return response.status(400).json({ error: 'Title is required and must be 160 characters or fewer.' });
      }
      if (typeof description !== 'string' || description.length > 5000) {
        return response.status(400).json({ error: 'Description must be 5,000 characters or fewer.' });
      }
      if (!priorities.includes(priority)) {
        return response.status(400).json({ error: 'Priority must be low, medium, or high.' });
      }
      const result = await database.query(
        `INSERT INTO tickets (title, description, priority) VALUES ($1, $2, $3) RETURNING id, title, description, status, priority, created_at`,
        [title.trim(), description.trim(), priority],
      );
      response.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/tickets/:id', async (request, response, next) => {
    try {
      const id = parseInteger(request.params.id);
      const { status, priority } = request.body ?? {};
      if (!Number.isSafeInteger(id) || id < 1) {
        return response.status(400).json({ error: 'Ticket ID must be a positive integer.' });
      }
      if ((status === undefined && priority === undefined) ||
          (status !== undefined && !statuses.includes(status)) ||
          (priority !== undefined && !priorities.includes(priority))) {
        return response.status(400).json({ error: 'Provide a valid status or priority to update.' });
      }
      const result = await database.query(
        `UPDATE tickets SET status = COALESCE($2, status), priority = COALESCE($3, priority) WHERE id = $1 RETURNING id, title, description, status, priority, created_at`,
        [id, status ?? null, priority ?? null],
      );
      if (!result.rowCount) return response.status(404).json({ error: 'Ticket not found.' });
      response.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  app.use('/tickets', (request, response) => {
    response.status(404).json({ error: 'Ticket endpoint not found.' });
  });

  if (staticDirectory) {
    app.use(express.static(staticDirectory));
    app.get('*', (request, response, next) => {
      response.sendFile('index.html', { root: staticDirectory }, (error) => {
        if (error) next(error);
      });
    });
  }

  app.use((request, response) => {
    response.status(404).json({ error: 'Route not found.' });
  });

  app.use((error, request, response, next) => {
    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'Request body must contain valid JSON.' });
    }
    if (error.status && error.status < 500) {
      return response.status(error.status).json({ error: error.message });
    }
    console.error(error);
    response.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}
