import { useCallback, useEffect, useState } from 'react';

const labels = { open: 'Open', in_progress: 'In progress', closed: 'Closed' };
const priorities = ['low', 'medium', 'high'];

async function request(path, options) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
  } catch {
    throw new Error('Could not reach the ticket service. Check that the API is running and try again.');
  }

  let data;
  try {
    data = response.status === 204 ? null : await response.json();
  } catch {
    throw new Error(`The ticket service returned an unreadable response (${response.status}).`);
  }
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status}).`);
  return data;
}

function App() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ open: 0, in_progress: 0, closed: 0 });
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pageSize = 8;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (filter !== 'all') query.set('status', filter);
      const [list, summary] = await Promise.all([
        request(`/tickets?${query}`), request('/tickets/stats'),
      ]);
      setTickets(list.tickets);
      setTotal(list.total);
      setStats(summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { refresh(); }, [refresh]);

  async function createTicket(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await request('/tickets', { method: 'POST', body: JSON.stringify(form) });
      setForm({ title: '', description: '', priority: 'medium' });
      if (page !== 1 || (filter !== 'all' && filter !== 'open')) {
        setPage(1);
        setFilter('all');
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(ticket, status) {
    try {
      await request(`/tickets/${ticket.id}`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Lodwar Services home">
          <span className="brand-mark">L</span><span>Lodwar Services</span>
        </a>
        <span className="topbar-note">Support desk</span>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">WORKSPACE / SUPPORT</p>
          <h1>Tickets</h1>
          <p className="subheading">A clear view of what needs attention.</p>
        </div>
        <div className="date-note">Ticket overview</div>
      </section>

      <section className="stats" aria-label="Ticket summary">
        {[
          ['open', 'Open tickets'], ['in_progress', 'In progress'], ['closed', 'Resolved'],
        ].map(([key, label]) => (
          <article className="stat-card" key={key}>
            <span className="stat-label">{label}</span>
            <strong>{stats[key]}</strong>
            <span className={`stat-dot ${key}`} aria-hidden="true" />
          </article>
        ))}
      </section>

      {error && <div className="alert" role="alert">{error}</div>}

      <div className="content-grid">
        <section className="list-panel" aria-labelledby="list-title">
          <div className="panel-heading">
            <div>
              <h2 id="list-title">All tickets <span className="count">{total}</span></h2>
              <p>Review and update incoming requests.</p>
            </div>
            <label className="filter-wrap">
              <span className="sr-only">Filter by status</span>
              <select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}>
                <option value="all">All statuses</option>
                {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          <div className="ticket-list" aria-live="polite">
            {loading ? <p className="empty-state">Loading tickets…</p> : tickets.length === 0 ? (
              <div className="empty-state"><span className="empty-icon">↗</span><strong>No tickets yet</strong><span>New requests will appear here.</span></div>
            ) : tickets.map((ticket) => (
              <article className="ticket" key={ticket.id}>
                <div className="ticket-main">
                  <div className="ticket-title-row">
                    <h3>{ticket.title}</h3>
                    <span className={`priority priority-${ticket.priority}`}><i />{ticket.priority}</span>
                  </div>
                  {ticket.description && <p className="ticket-description">{ticket.description}</p>}
                  <div className="ticket-meta">
                    <span>#{ticket.id}</span><span className="meta-divider">·</span>
                    <time dateTime={ticket.created_at}>{new Date(ticket.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
                  </div>
                </div>
                <label className={`status-control status-${ticket.status}`}>
                  <span className="sr-only">Status for {ticket.title}</span>
                  <select value={ticket.status} onChange={(event) => changeStatus(ticket, event.target.value)}>
                    {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </article>
            ))}
          </div>
          <div className="pagination">
            <span>{total === 0 ? 'No results' : `Page ${page} of ${pageCount}`}</span>
            <div>
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading}>Previous</button>
              <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page >= pageCount || loading}>Next</button>
            </div>
          </div>
        </section>

        <aside className="form-panel">
          <div className="form-heading">
            <span className="form-icon">＋</span>
            <div><h2>New ticket</h2><p>Add a support request to the queue.</p></div>
          </div>
          <form onSubmit={createTicket}>
            <label htmlFor="title">Title <span className="required">*</span></label>
            <input id="title" name="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What needs attention?" maxLength="160" required />

            <label htmlFor="description">Description <span className="optional">Optional</span></label>
            <textarea id="description" name="description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Add a few helpful details…" rows="4" maxLength="5000" />

            <label htmlFor="priority">Priority</label>
            <select id="priority" name="priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              {priorities.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
            </select>
            <button className="submit-button" type="submit" disabled={saving}>{saving ? 'Adding ticket…' : 'Create ticket'}<span aria-hidden="true">↗</span></button>
          </form>
          <p className="form-footnote"><span>⌘</span> Tickets start with an open status.</p>
        </aside>
      </div>
      <footer>LODWAR SERVICES <span>·</span> SUPPORT DESK</footer>
    </main>
  );
}

export default App;
