# Dashboard

Local web app for classes and projects: Canvas deadlines, vault notes, files, and Claude Code sessions. Pages: Overview, Assignments, Projects.

## Run

| Command | What it does |
|---|---|
| `npm start` | Build the UI and serve it at http://localhost:4321 |
| `npm test` | Server tests (vitest) |
| `npm run dev` | Server + Vite dev server with hot reload (http://localhost:5173) |
| `npm run clean` | Delete `dist/` (the only build output) |

First time: `npm install`.

## Putting something on the dashboard

Add a `dashboard:` block to any note's frontmatter under `MyNotes/` (Archive is skipped):

```yaml
dashboard:
  group: Classes            # section heading; defaults to Projects
  path: 'C:\path\to\folder' # enables New Claude, Folder, and the session list
  ssh: jherbe3@zeus.cec.gmu.edu
  links:
    - label: Canvas
      url: https://...       # opens in a new tab (Canvas, Google Docs, anything web)
    - label: Design doc
      file: 'C:\path\to\design.docx'  # opens with its default app (Word, etc.)
```

Use single quotes around Windows paths.

## Canvas deadlines

1. In Canvas, open **Calendar** and click **Calendar Feed** (bottom right). Copy the link.
2. Copy `.env.example` to `.env` and paste the link after `CANVAS_ICS_URL=`.
3. Restart (`npm start`).

The link contains a secret token, so `.env` is gitignored. The feed has no submission status: tick the checkbox to mark something done (remembered in this browser).

## How it works

- `server/vault.js` finds notes with a `dashboard:` block.
- `server/sessions.js` reads `~/.claude/projects/*/*.jsonl` for sessions whose cwd is inside `path` (subfolders included). This file format is undocumented by Anthropic; if a Claude Code update breaks the session list, this is the file to fix.
- `server/canvas.js` fetches the Canvas calendar feed (cached 15 min; the Refresh button skips the cache) and returns the next 30 days.
- `server/launch.js` opens Windows Terminal (`claude --resume <id>`), Explorer, or SSH.

## Security

The server launches programs, so it listens on 127.0.0.1 only, rejects non-localhost `Host` headers, accepts JSON only, and never takes a path or command from the browser: requests name an item/session/link by id and the server looks it up in the vault.

## Config (env vars)

`CANVAS_ICS_URL` (unset = no deadlines), `PORT` (4321), `VAULT_DIR` (`~/Documents/Obsidian/Jackson-Windows/MyNotes`), `CLAUDE_PROJECTS_DIR` (`~/.claude/projects`).
