import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { encodePath, parseSession, listSessions } from './sessions.js';

const jsonl = (...entries) => entries.map((e) => JSON.stringify(e)).join('\n') + '\n';

describe('encodePath', () => {
  it('matches Claude Code project folder naming', () => {
    expect(encodePath('C:\\Users\\jwesl\\Documents\\MasonClass\\Fall2026\\CS468 Secure Programming & Systems'))
      .toBe('C--Users-jwesl-Documents-MasonClass-Fall2026-CS468-Secure-Programming---Systems');
  });
});

describe('parseSession', () => {
  it('takes cwd, first typed prompt, and prefers the latest custom title', () => {
    const s = parseSession(jsonl(
      { type: 'mode', mode: 'normal' },
      { type: 'user', isMeta: true, message: { content: 'meta' }, cwd: 'C:\\p' },
      { type: 'user', message: { content: '<command-name>/clear</command-name>' }, cwd: 'C:\\p' },
      { type: 'user', message: { content: 'fix the bug' }, cwd: 'C:\\p' },
      { type: 'user', message: { content: [{ type: 'tool_result' }] }, cwd: 'C:\\p' },
      { type: 'ai-title', aiTitle: 'AI title' },
      { type: 'custom-title', customTitle: 'Mine v1' },
      { type: 'ai-title', aiTitle: 'AI title 2' },
      { type: 'custom-title', customTitle: 'Mine v2' },
    ));
    expect(s).toEqual({ cwd: 'C:\\p', firstPrompt: 'fix the bug', title: 'Mine v2' });
  });

  it('falls back to ai title, tolerates bad lines, truncates long prompts', () => {
    const s = parseSession('not json\n' + jsonl(
      { type: 'user', message: { content: 'x'.repeat(500) }, cwd: 'C:\\p' },
      { type: 'ai-title', aiTitle: 'AI' },
    ));
    expect(s.title).toBe('AI');
    expect(s.firstPrompt.length).toBeLessThanOrEqual(200);
  });
});

describe('listSessions', () => {
  it('finds sessions in the project folder and its subfolders, newest first', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-projects-'));
    const put = (folder, id, cwd, prompt, mtime) => {
      fs.mkdirSync(path.join(dir, folder), { recursive: true });
      const file = path.join(dir, folder, `${id}.jsonl`);
      fs.writeFileSync(file, jsonl({ type: 'user', message: { content: prompt }, cwd }));
      fs.utimesSync(file, mtime, mtime);
    };
    const root = 'C:\\Code\\App';
    put('C--Code-App', 'a0000000-0000-0000-0000-000000000001', root, 'old', new Date('2026-01-01'));
    put('C--Code-App-sub', 'a0000000-0000-0000-0000-000000000002', 'C:\\Code\\App\\sub', 'new', new Date('2026-02-01'));
    // Same encoded prefix but a different real folder: must be excluded.
    put('C--Code-App-other', 'a0000000-0000-0000-0000-000000000003', 'C:\\Code\\App-other', 'nope', new Date('2026-03-01'));
    // No typed prompt: nothing to resume.
    put('C--Code-App', 'a0000000-0000-0000-0000-000000000004', root, [{ type: 'tool_result' }], new Date('2026-04-01'));

    const sessions = listSessions(dir, root + '\\');
    expect(sessions.map((s) => s.firstPrompt)).toEqual(['new', 'old']);
    expect(sessions[0]).toMatchObject({
      id: 'a0000000-0000-0000-0000-000000000002',
      cwd: 'C:\\Code\\App\\sub',
      updated: new Date('2026-02-01').toISOString(),
    });
  });

  it('returns [] when the projects dir is missing', () => {
    expect(listSessions(path.join(os.tmpdir(), 'does-not-exist-xyz'), 'C:\\x')).toEqual([]);
  });
});
