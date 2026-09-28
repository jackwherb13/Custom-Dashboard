import fs from 'node:fs';
import path from 'node:path';

// Claude Code stores sessions in ~/.claude/projects/<cwd with non-alphanumerics → '-'>/<sessionId>.jsonl.
// This format is undocumented; keep all knowledge of it in this file.
export const encodePath = (p) => p.replace(/[^a-zA-Z0-9]/g, '-');

const normalize = (p) => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();

export function parseSession(text) {
  let cwd = null, firstPrompt = null, customTitle = null, aiTitle = null;
  for (const line of text.split('\n')) {
    if (!line) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (!cwd && e.cwd) cwd = e.cwd;
    if (e.type === 'custom-title') customTitle = e.customTitle;
    else if (e.type === 'ai-title') aiTitle = e.aiTitle;
    else if (!firstPrompt && e.type === 'user' && !e.isMeta && !e.isSidechain) {
      const content = e.message?.content;
      if (typeof content === 'string' && !content.startsWith('<')) firstPrompt = content.slice(0, 200);
    }
  }
  return { cwd, firstPrompt, title: customTitle ?? aiTitle };
}

// Session files can be several MB; only re-parse when they change.
const cache = new Map();

function readSession(file) {
  const { mtimeMs, mtime } = fs.statSync(file);
  const hit = cache.get(file);
  if (hit?.mtimeMs === mtimeMs) return hit.session;
  const session = { ...parseSession(fs.readFileSync(file, 'utf8')), updated: mtime.toISOString() };
  cache.set(file, { mtimeMs, session });
  return session;
}

export function listSessions(projectsDir, projectPath) {
  if (!fs.existsSync(projectsDir)) return [];
  const root = normalize(projectPath);
  const prefix = encodePath(projectPath.replace(/[\\/]+$/, ''));
  const sessions = [];
  for (const dir of fs.readdirSync(projectsDir)) {
    if (dir !== prefix && !dir.startsWith(prefix + '-')) continue;
    const full = path.join(projectsDir, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const file of fs.readdirSync(full)) {
      if (!file.endsWith('.jsonl')) continue;
      const s = readSession(path.join(full, file));
      if (!s.firstPrompt || !s.cwd) continue;
      // The encoding is lossy (App-other vs App\other), so confirm with the real cwd.
      const cwd = normalize(s.cwd);
      if (cwd !== root && !cwd.startsWith(root + '\\')) continue;
      sessions.push({ id: path.basename(file, '.jsonl'), ...s });
    }
  }
  return sessions.sort((a, b) => b.updated.localeCompare(a.updated));
}
