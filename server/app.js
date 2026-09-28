import express from 'express';
import { loadItems } from './vault.js';
import { listSessions } from './sessions.js';
import { resumeCommand, newSessionCommand, sshCommand, openCommand } from './launch.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export function createApp({
  vaultDir, projectsDir, run, staticDir,
  getDeadlines = async () => ({ configured: false, deadlines: [] }),
}) {
  const app = express();

  // This server launches programs. Only answer to localhost so a web page that
  // rebinds its own domain to 127.0.0.1 can't drive it.
  app.use('/api', (req, res, next) => {
    const host = (req.headers.host ?? '').replace(/:\d+$/, '');
    if (!LOCAL_HOSTS.has(host)) return res.status(403).json({ error: 'forbidden host' });
    next();
  });
  app.use(express.json());

  const getItems = () => {
    const items = loadItems(vaultDir).map((item) => ({
      ...item,
      sessions: item.path ? listSessions(projectsDir, item.path) : [],
    }));
    // A class folder contains its project folders; a session belongs only to the deepest item that holds it.
    const owner = new Map();
    for (const item of items) {
      for (const s of item.sessions) {
        if (!owner.has(s.id) || item.path.length > owner.get(s.id).path.length) owner.set(s.id, item);
      }
    }
    return items.map((item) => ({ ...item, sessions: item.sessions.filter((s) => owner.get(s.id) === item) }));
  };

  app.get('/api/items', (req, res) => res.json(getItems()));
  app.get('/api/deadlines', async (req, res) => res.json(await getDeadlines()));

  // Clients name things by id; every path/command comes from the vault or session files, never the request.
  app.post('/api/launch', (req, res) => {
    // JSON-only means a cross-site page can't POST here without a CORS preflight, which we never grant.
    if (!req.is('application/json')) return res.status(415).json({ error: 'expected JSON' });
    const { action, itemId, sessionId, linkIndex } = req.body;
    const item = getItems().find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'unknown item' });

    const bad = (error) => res.status(400).json({ error });
    let command;
    switch (action) {
      case 'resume': {
        const session = item.sessions.find((s) => s.id === sessionId);
        if (!session) return res.status(404).json({ error: 'unknown session' });
        command = resumeCommand(session.cwd, session.id);
        break;
      }
      case 'new':
        if (!item.path) return bad('item has no path');
        command = newSessionCommand(item.path);
        break;
      case 'folder':
        if (!item.path) return bad('item has no path');
        command = openCommand(item.path);
        break;
      case 'ssh':
        if (!item.ssh) return bad('item has no ssh target');
        command = sshCommand(item.ssh);
        break;
      case 'file': {
        const link = item.links[linkIndex];
        if (!link?.file) return bad('not a file link');
        command = openCommand(link.file);
        break;
      }
      default:
        return bad('unknown action');
    }
    run(command);
    res.json({ ok: true });
  });

  if (staticDir) app.use(express.static(staticDir));
  return app;
}
