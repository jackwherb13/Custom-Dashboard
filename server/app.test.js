import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from './app.js';

const ID = '66f4709a-29eb-470d-ad3a-19a1b0db5b72';
let app, calls, vaultDir, projectsDir;

beforeEach(() => {
  const vault = vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-'));
  const projects = projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-projects-'));
  fs.writeFileSync(path.join(vault, 'App.md'), [
    '---', 'title: App', 'dashboard:', "  path: 'C:\\Code\\App'", '  ssh: me@zeus.example.edu', '  links:',
    '    - label: Doc', '      url: https://docs.example/1',
    '    - label: Word', "      file: 'C:\\docs\\a.docx'", '---', '',
  ].join('\n'));
  fs.writeFileSync(path.join(vault, 'Bare.md'), '---\ntitle: Bare\ndashboard:\n  group: Classes\n---\n');
  fs.mkdirSync(path.join(projects, 'C--Code-App'));
  fs.writeFileSync(path.join(projects, 'C--Code-App', `${ID}.jsonl`),
    JSON.stringify({ type: 'user', message: { content: 'hello' }, cwd: 'C:\\Code\\App' }) + '\n');
  calls = [];
  app = createApp({ vaultDir: vault, projectsDir: projects, run: (c) => calls.push(c) });
});

const launch = (body) => request(app).post('/api/launch').send(body);

describe('GET /api/items', () => {
  it('returns vault items with their sessions', async () => {
    const res = await request(app).get('/api/items').expect(200);
    const appItem = res.body.find((i) => i.id === 'App.md');
    expect(appItem.sessions).toHaveLength(1);
    expect(appItem.sessions[0].firstPrompt).toBe('hello');
    expect(res.body.find((i) => i.id === 'Bare.md').sessions).toEqual([]);
  });

  it('gives a session only to the deepest item whose path contains it', async () => {
    const sub = 'b0000000-0000-0000-0000-000000000001';
    fs.writeFileSync(path.join(vaultDir, 'Sub.md'), "---\ntitle: Sub\ndashboard:\n  path: 'C:\\Code\\App\\sub'\n---\n");
    fs.mkdirSync(path.join(projectsDir, 'C--Code-App-sub'));
    fs.writeFileSync(path.join(projectsDir, 'C--Code-App-sub', `${sub}.jsonl`),
      JSON.stringify({ type: 'user', message: { content: 'in sub' }, cwd: 'C:\\Code\\App\\sub' }) + '\n');
    const res = await request(app).get('/api/items').expect(200);
    const ids = (id) => res.body.find((i) => i.id === id).sessions.map((s) => s.id);
    expect(ids('App.md')).toEqual([ID]);
    expect(ids('Sub.md')).toEqual([sub]);
  });

  it('rejects requests whose Host is not localhost (DNS rebinding)', async () => {
    await request(app).get('/api/items').set('Host', 'evil.example:4321').expect(403);
  });
});

describe('GET /api/deadlines', () => {
  it('returns what the deadlines source gives', async () => {
    const deadlines = [{ id: 'a', title: 'Lab 1' }];
    const withCanvas = createApp({ vaultDir, projectsDir, run: () => {}, getDeadlines: async () => ({ configured: true, deadlines }) });
    const res = await request(withCanvas).get('/api/deadlines').expect(200);
    expect(res.body).toEqual({ configured: true, deadlines });
  });

  it('passes ?fresh=1 through to the deadlines source', async () => {
    const seen = [];
    const withCanvas = createApp({
      vaultDir, projectsDir, run: () => {},
      getDeadlines: async (opts) => { seen.push(opts); return { configured: true, deadlines: [] }; },
    });
    await request(withCanvas).get('/api/deadlines').expect(200);
    await request(withCanvas).get('/api/deadlines?fresh=1').expect(200);
    expect(seen).toEqual([{ fresh: false }, { fresh: true }]);
  });

  it('is unconfigured by default', async () => {
    const res = await request(app).get('/api/deadlines').expect(200);
    expect(res.body).toEqual({ configured: false, deadlines: [] });
  });
});

describe('POST /api/launch', () => {
  it('resumes a known session', async () => {
    await launch({ action: 'resume', itemId: 'App.md', sessionId: ID }).expect(200);
    expect(calls).toEqual([{ cmd: 'wt.exe', args: ['-d', 'C:\\Code\\App', 'powershell', '-NoExit', '-Command', 'claude', '--resume', ID] }]);
  });

  it('refuses unknown items and sessions', async () => {
    await launch({ action: 'resume', itemId: 'Nope.md', sessionId: ID }).expect(404);
    await launch({ action: 'resume', itemId: 'App.md', sessionId: 'a0000000-0000-0000-0000-000000000000' }).expect(404);
    expect(calls).toEqual([]);
  });

  it('starts new sessions, opens folders and ssh', async () => {
    await launch({ action: 'new', itemId: 'App.md' }).expect(200);
    await launch({ action: 'folder', itemId: 'App.md' }).expect(200);
    await launch({ action: 'ssh', itemId: 'App.md' }).expect(200);
    expect(calls.map((c) => c.args.at(-1))).toEqual(['claude', 'C:\\Code\\App', 'me@zeus.example.edu']);
  });

  it('opens only file links that are in the note', async () => {
    await launch({ action: 'file', itemId: 'App.md', linkIndex: 1 }).expect(200);
    await launch({ action: 'file', itemId: 'App.md', linkIndex: 0 }).expect(400);
    await launch({ action: 'file', itemId: 'App.md', linkIndex: 9 }).expect(400);
    expect(calls).toEqual([{ cmd: 'explorer.exe', args: ['C:\\docs\\a.docx'] }]);
  });

  it('400s when the item lacks what the action needs', async () => {
    await launch({ action: 'new', itemId: 'Bare.md' }).expect(400);
    await launch({ action: 'ssh', itemId: 'Bare.md' }).expect(400);
    await launch({ action: 'bogus', itemId: 'App.md' }).expect(400);
  });

  it('requires a JSON body (blocks simple cross-site form posts)', async () => {
    await request(app).post('/api/launch').type('form').send('action=new&itemId=App.md').expect(415);
    expect(calls).toEqual([]);
  });
});
