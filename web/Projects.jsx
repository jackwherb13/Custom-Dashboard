import { useState } from 'react';
import { Icon } from './icons.jsx';
import { SessionList } from './Sessions.jsx';
import { courseCode, groupOrder, timeAgo } from './lib.js';

function ItemRow({ item, act, canvasUrl }) {
  const [open, setOpen] = useState(false);
  const n = item.sessions.length;
  return (
    <li className={`item ${item.status === 'done' ? 'finished' : ''}`}>
      <div className="item-line">
        <button className="item-name" onClick={() => setOpen(!open)} disabled={!n} aria-expanded={open}
          title={item.path ?? undefined}>
          <span className={`chev ${open ? 'open' : ''}`}><Icon name="chevron" size={14} /></span>
          {item.title}
        </button>
        <span className="item-meta">{n ? `${n} session${n === 1 ? '' : 's'}, last ${timeAgo(item.sessions[0].updated)}` : 'No sessions yet'}</span>
      </div>
      <div className="item-actions">
        {item.path && <button className="accent" onClick={() => act({ action: 'new', itemId: item.id }, `Starting Claude in ${item.title}`)}>New session</button>}
        {item.path && <button onClick={() => act({ action: 'folder', itemId: item.id }, `Opening ${item.title} folder`)}>Folder</button>}
        {item.ssh && <button onClick={() => act({ action: 'ssh', itemId: item.id }, 'Connecting to zeus')}>Zeus</button>}
        {canvasUrl && <a href={canvasUrl} target="_blank" rel="noreferrer">Canvas</a>}
        {item.links.map((link, i) => (link.url
          ? <a key={i} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
          : <button key={i} onClick={() => act({ action: 'file', itemId: item.id, linkIndex: i }, `Opening ${link.label}`)}>{link.label}</button>))}
      </div>
      {open && <SessionList entries={item.sessions.map((s) => ({ s, item }))} act={act} showItem={false} />}
    </li>
  );
}

export function ProjectsPage({ items, act, deadlines }) {
  const groups = Map.groupBy(items, (i) => i.group);
  // Course pages come from the Canvas feed, so a class shows its link while it has something due.
  const courseUrls = new Map(deadlines.filter((d) => d.courseUrl).map((d) => [courseCode(d.course), d.courseUrl]));
  return (
    <>
      <header className="page-head"><h1>Classes and projects</h1></header>
      <p className="lede">
        Anything in your vault with a <code>dashboard:</code> block. Open a folder, start Claude there, or pick up an old session.
      </p>
      <div className="project-groups">
        {[...groups.keys()].sort(groupOrder).map((g) => (
          <section key={g}>
            <h2>{g}</h2>
            <ul className="items">
              {groups.get(g)
                .sort((a, b) => (a.status === 'done') - (b.status === 'done') || a.title.localeCompare(b.title))
                .map((item) => <ItemRow key={item.id} item={item} act={act} canvasUrl={courseUrls.get(courseCode(item.title))} />)}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
