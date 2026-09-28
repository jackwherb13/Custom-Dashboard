import { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import WeekCard from './WeekCard.jsx';
import { AssignmentsPage, CanvasNotice, DueList } from './Deadlines.jsx';
import { ProjectsPage } from './Projects.jsx';
import { courseCode, dueLabel, nextUp, projectsByActivity, timeAgo, weekBucket } from './lib.js';

async function launch(body) {
  const res = await fetch('/api/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
}

// The Canvas feed can't say what's submitted, so "done" is remembered in this browser only.
const DONE_KEY = 'dashboard.doneDeadlines';
function loadDone() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}
function saveDone(set) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...set]));
  } catch { /* storage unavailable: done state lasts until reload */ }
}

const PAGES = [
  { hash: '#/', label: 'Overview' },
  { hash: '#/assignments', label: 'Assignments' },
  { hash: '#/projects', label: 'Projects' },
];

function useHash() {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const onChange = () => { setHash(location.hash || '#/'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return PAGES.some((p) => p.hash === hash) ? hash : '#/';
}

function Summary({ canvas, done }) {
  if (!canvas.configured || canvas.error) return null;
  const open = canvas.deadlines.filter((d) => !done.has(d.id) && weekBucket(d.due) === 'This week').length;
  const next = nextUp(canvas.deadlines, done);
  return (
    <p className="summary">
      <strong>{open === 0 ? 'Nothing left due this week.' : `${open} thing${open === 1 ? '' : 's'} due this week.`}</strong>
      {next && ` Next up is ${next.title}${courseCode(next.course) ? ` for ${courseCode(next.course)}` : ''}, ${dueLabel(next.due).replace(/^\w/, (c) => c.toLowerCase())}.`}
    </p>
  );
}

function ProjectList({ items, act }) {
  return (
    <ul className="project-list">
      {items.map((item) => {
        const last = item.sessions[0];
        return (
          <li key={item.id} className={item.status === 'done' ? 'finished' : ''}>
            <div className="project-text">
              <span className="project-name">{item.title}</span>
              <span className="project-meta">
                {last ? `${timeAgo(last.updated)}: ${last.title ?? last.firstPrompt}` : 'No sessions yet'}
              </span>
            </div>
            <div className="project-actions">
              {last && (
                <button onClick={() => act({ action: 'resume', itemId: item.id, sessionId: last.id }, `Resuming “${last.title ?? last.firstPrompt}”`)}>
                  <Icon name="play" size={11} /> Resume
                </button>
              )}
              {item.path && (
                <button className="accent" onClick={() => act({ action: 'new', itemId: item.id }, `Starting Claude in ${item.title}`)}>
                  New session
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Overview({ items, canvas, done, toggle, act }) {
  const now = new Date();
  const thisWeek = canvas.deadlines.filter((d) => weekBucket(d.due) === 'This week');
  const projects = projectsByActivity(items).slice(0, 6);
  return (
    <>
      <div className="overview-top">
        <div>
          <h1>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
          <Summary canvas={canvas} done={done} />
        </div>
        {canvas.configured && !canvas.error && <WeekCard deadlines={canvas.deadlines} done={done} />}
      </div>

      <div className="columns">
        <section>
          <div className="section-head">
            <h2>Due this week</h2>
            <a href="#/assignments" className="more">All assignments</a>
          </div>
          <CanvasNotice data={canvas} />
          {canvas.configured && !canvas.error && (thisWeek.length
            ? <DueList deadlines={thisWeek} done={done} toggle={toggle} />
            : <p className="empty">Nothing due this week.</p>)}
        </section>

        <section>
          <div className="section-head">
            <h2>Projects</h2>
            <a href="#/projects" className="more">All classes and projects</a>
          </div>
          {projects.length
            ? <ProjectList items={projects} act={act} />
            : <p className="empty">Add a <code>dashboard:</code> block to a project note in your vault to see it here.</p>}
        </section>
      </div>
    </>
  );
}

export default function App() {
  const hash = useHash();
  const [items, setItems] = useState(null);
  const [canvas, setCanvas] = useState(null);
  const [toast, setToast] = useState(null);
  const [done, setDone] = useState(loadDone);

  const notify = (text, error = false) => {
    setToast({ text, error });
    setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 3000);
  };
  const getJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))));
  const load = () => {
    getJson('/api/items').then(setItems, (e) => notify(e.message, true));
    getJson('/api/deadlines').then(setCanvas, (e) => setCanvas({ configured: true, deadlines: [], error: e.message }));
  };
  useEffect(() => { load(); }, []);

  const act = (body, message) => {
    notify(message);
    launch(body).catch((e) => notify(e.message, true));
  };
  const toggle = (id) => setDone((prev) => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    saveDone(next);
    return next;
  });

  if (!items || !canvas) return <div className="loading">Loading…</div>;

  const openThisWeek = canvas.deadlines.filter((d) => !done.has(d.id) && weekBucket(d.due) === 'This week').length;

  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-links">
          {PAGES.map((p) => (
            <a key={p.hash} href={p.hash} aria-current={hash === p.hash ? 'page' : undefined}>
              {p.label}
              {p.hash === '#/assignments' && openThisWeek > 0 && <span className="nav-count">{openThisWeek}</span>}
            </a>
          ))}
        </div>
        <button className="quiet" onClick={() => { load(); notify('Refreshed'); }} title="Reload notes, sessions and Canvas">
          <Icon name="refresh" /> Refresh
        </button>
      </nav>

      {hash === '#/' && <Overview items={items} canvas={canvas} done={done} toggle={toggle} act={act} />}
      {hash === '#/assignments' && <AssignmentsPage canvas={canvas} done={done} toggle={toggle} />}
      {hash === '#/projects' && <ProjectsPage items={items} act={act} />}

      {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role="status">{toast.text}</div>}
    </div>
  );
}
