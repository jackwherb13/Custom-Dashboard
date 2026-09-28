import { useState } from 'react';
import { Icon } from './icons.jsx';
import { courseCode, dueLabel, urgencyClass, weekBucket } from './lib.js';

export function CanvasNotice({ data }) {
  if (!data.configured) {
    return (
      <p className="empty">
        Connect Canvas to see what's due: in Canvas open Calendar, copy the <em>Calendar Feed</em> link, add it to
        {' '}<code>.env</code> as <code>CANVAS_ICS_URL</code>, and restart the dashboard.
      </p>
    );
  }
  if (data.error) return <p className="empty error-text">{data.error}. Check the feed link in <code>.env</code>.</p>;
  return null;
}

export function DueList({ deadlines, done, toggle }) {
  const list = [...deadlines].sort((a, b) => done.has(a.id) - done.has(b.id));
  return (
    <ul className="due-list">
      {list.map((d) => (
        <li key={d.id} className={done.has(d.id) ? 'done' : urgencyClass(d.due)}>
          <label>
            <input type="checkbox" checked={done.has(d.id)} onChange={() => toggle(d.id)} />
            <span className="due-title">{d.title}</span>
          </label>
          <span className="due-course" title={d.course ?? undefined}>{courseCode(d.course)}</span>
          <span className="due-when">{dueLabel(d.due)}</span>
          {d.url
            ? <a href={d.url} target="_blank" rel="noreferrer" className="quiet" title="Open in Canvas"><Icon name="external" size={14} /></a>
            : <span />}
        </li>
      ))}
    </ul>
  );
}

const BUCKETS = ['This week', 'Next week', 'Later'];

export function AssignmentsPage({ canvas, done, toggle }) {
  const [hideDone, setHideDone] = useState(false);
  const visible = canvas.deadlines.filter((d) => !(hideDone && done.has(d.id)));
  const doneCount = canvas.deadlines.filter((d) => done.has(d.id)).length;
  return (
    <>
      <header className="page-head">
        <h1>Assignments</h1>
        {canvas.configured && canvas.deadlines.length > 0 && (
          <label className="toggle">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
            Hide done ({doneCount})
          </label>
        )}
      </header>
      <p className="lede">Everything due in the next 30 days, from your Canvas calendar. Tick an item when you've turned it in.</p>
      <CanvasNotice data={canvas} />
      {canvas.configured && !canvas.error && visible.length === 0 && <p className="empty">Nothing left to do in the next 30 days.</p>}
      <div className="narrow">
        {BUCKETS.map((bucket) => {
          const items = visible.filter((d) => weekBucket(d.due) === bucket);
          return items.length > 0 && (
            <section key={bucket}>
              <h2>{bucket}</h2>
              <DueList deadlines={items} done={done} toggle={toggle} />
            </section>
          );
        })}
      </div>
    </>
  );
}
