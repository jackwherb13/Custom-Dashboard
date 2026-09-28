import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseNote, loadItems } from './vault.js';

const note = (fm) => `---\n${fm}\n---\n\n# Body\n`;

describe('parseNote', () => {
  it('returns null without a dashboard block', () => {
    expect(parseNote(note('title: X'), 'x.md')).toBeNull();
    expect(parseNote('# no frontmatter', 'x.md')).toBeNull();
  });

  it('parses title, path, ssh, group and links', () => {
    const item = parseNote(note([
      'title: CS475',
      'status: active',
      'dashboard:',
      '  group: Classes',
      "  path: 'C:\\Users\\me\\CS475 Concurrent & Distributed'",
      '  ssh: me@zeus.example.edu',
      '  links:',
      '    - label: Canvas',
      '      url: https://canvas.example.edu/courses/1',
      '    - label: Design doc',
      "      file: 'C:\\docs\\design.docx'",
    ].join('\n')), 'Learning/CS475.md');
    expect(item).toEqual({
      id: 'Learning/CS475.md',
      title: 'CS475',
      status: 'active',
      group: 'Classes',
      path: 'C:\\Users\\me\\CS475 Concurrent & Distributed',
      ssh: 'me@zeus.example.edu',
      links: [
        { label: 'Canvas', url: 'https://canvas.example.edu/courses/1' },
        { label: 'Design doc', file: 'C:\\docs\\design.docx' },
      ],
    });
  });

  it('defaults group to Projects and drops malformed links', () => {
    const item = parseNote(note([
      'title: Y',
      'dashboard:',
      '  links:',
      '    - label: no target',
      '    - url: https://no-label.example',
    ].join('\n')), 'y.md');
    expect(item.group).toBe('Projects');
    expect(item.path).toBeNull();
    expect(item.links).toEqual([]);
  });

  it('returns null on invalid YAML', () => {
    expect(parseNote(note('dashboard: [unclosed'), 'z.md')).toBeNull();
  });
});

describe('loadItems', () => {
  it('walks the vault recursively, skipping Archive and dot folders', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-'));
    const write = (rel, text) => {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), text);
    };
    const dash = note('title: A\ndashboard:\n  group: Projects');
    write('Projects/A/README.md', dash);
    write('Projects/A/Progress.md', note('title: not on dashboard'));
    write('Archive/Old.md', dash);
    write('.obsidian/x.md', dash);
    expect(loadItems(dir).map((i) => i.id)).toEqual(['Projects/A/README.md']);
  });
});
