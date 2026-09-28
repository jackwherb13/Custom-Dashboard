import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const SKIP_DIRS = new Set(['Archive', 'node_modules']);

// A note shows on the dashboard only if its frontmatter has a `dashboard:` block.
export function parseNote(text, id) {
  const match = text.match(FRONTMATTER);
  if (!match) return null;
  let meta;
  try {
    meta = YAML.parse(match[1]);
  } catch {
    return null;
  }
  const dash = meta?.dashboard;
  if (!dash || typeof dash !== 'object') return null;

  const links = (Array.isArray(dash.links) ? dash.links : [])
    .filter((l) => l?.label && (l.url || l.file))
    .map((l) => (l.url
      ? { label: String(l.label), url: String(l.url) }
      : { label: String(l.label), file: String(l.file) }));

  return {
    id,
    title: meta.title ?? id,
    status: meta.status ?? null,
    group: dash.group ?? 'Projects',
    path: dash.path ?? null,
    ssh: dash.ssh ?? null,
    links,
  };
}

export function loadItems(vaultDir) {
  const items = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) {
        const id = path.relative(vaultDir, full).split(path.sep).join('/');
        const item = parseNote(fs.readFileSync(full, 'utf8'), id);
        if (item) items.push(item);
      }
    }
  };
  walk(vaultDir);
  return items;
}
