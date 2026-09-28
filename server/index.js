import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { run } from './launch.js';
import { createDeadlines } from './canvas.js';

const port = Number(process.env.PORT ?? 4321);
const vaultDir = process.env.VAULT_DIR ?? path.join(os.homedir(), 'Documents', 'Obsidian', 'Jackson-Windows', 'MyNotes');
const projectsDir = process.env.CLAUDE_PROJECTS_DIR ?? path.join(os.homedir(), '.claude', 'projects');
const staticDir = fileURLToPath(new URL('../dist', import.meta.url));
const getDeadlines = createDeadlines({ url: process.env.CANVAS_ICS_URL });

createApp({ vaultDir, projectsDir, run, staticDir, getDeadlines })
  // Express 5 calls this on 'error' as well as on success.
  .listen(port, '127.0.0.1', (err) => {
    if (!err) return console.log(`Dashboard: http://localhost:${port}`);
    if (err.code !== 'EADDRINUSE') throw err;
    console.error(`Port ${port} is already in use - the dashboard is probably already running.\n`
      + `Stop it (close its terminal) and run npm start again, or set PORT to use another port.`);
    process.exit(1);
  });
