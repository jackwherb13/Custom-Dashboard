import { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import Timeline from './Timeline.jsx';
import { AssignmentsPage, CanvasNotice, DueList } from './Deadlines.jsx';
import { ProjectsPage } from './Projects.jsx';
import { SessionList } from './Sessions.jsx';
import { sameDay, weekBucket } from './lib.js';

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

function Overview({ items, canvas, sessions, done, toggle, act }) {
  const [day, setDay] = useState(null);
  const now = new Date();
  const thisWeek = canvas.deadlines.filter((d) => weekBucket(d.due) === 'This week');
  const recent = (day ? sessions.filter(({ s }) => sameDay(new Date(s.updated), day)) : sessions).slice(0, 6);
  return (
    <>
      <header className="page-head">
        <h1>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
      </header>

      <Timeline sessions={sessions} deadlines={canvas.deadlines} done={done} selected={day} onSelect={setDay} />

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
            <h2>{day ? `Sessions on ${day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}` : 'Recent sessions'}</h2>
            {day
              ? <button className="quiet" onClick={() => setDay(null)}>Show all</button>
              : <a href="#/projects" className="more">All projects</a>}
          </div>
          {recent.length
            ? <SessionList entries={recent} act={act} />
            : <p className="empty">{items.length ? `No Claude sessions ${day ? 'that day' : 'yet'}.` : 'Add a dashboard: block to a vault note to get started.'}</p>}
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

  const sessions = items
    .flatMap((item) => item.sessions.map((s) => ({ s, item })))
    .sort((a, b) => b.s.updated.localeCompare(a.s.updated));
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

      {hash === '#/' && <Overview items={items} canvas={canvas} sessions={sessions} done={done} toggle={toggle} act={act} />}
      {hash === '#/assignments' && <AssignmentsPage canvas={canvas} done={done} toggle={toggle} />}
      {hash === '#/projects' && <ProjectsPage items={items} act={act} />}

      {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role="status">{toast.text}</div>}
    </div>
  );
}
