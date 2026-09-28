import { useState } from 'react';
import { Icon } from './icons.jsx';
import { courseCode, dueDay, dueLabel, sameDay, weekDays } from './lib.js';

const WEEK_NAMES = ['This week', 'Next week', 'In two weeks', 'In three weeks', 'In four weeks'];

// Canvas deadlines one week at a time; pick a day to see what's due.
export default function WeekCard({ deadlines, done }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(() => new Date());
  const days = weekDays(offset);
  const today = new Date();
  const on = (d) => deadlines.filter((x) => sameDay(dueDay(x.due), d));

  const go = (next) => {
    setOffset(next);
    setSelected(next === 0 ? new Date() : weekDays(next)[0]);
  };
  const items = on(selected);

  return (
    <section className="week-card">
      <div className="week-card-head">
        <h2>{WEEK_NAMES[offset]}</h2>
        <div className="arrows">
          <button className="quiet" onClick={() => go(offset - 1)} disabled={offset === 0} aria-label="Previous week">
            <Icon name="chevron" size={14} flip />
          </button>
          <button className="quiet" onClick={() => go(offset + 1)} disabled={offset === WEEK_NAMES.length - 1} aria-label="Next week">
            <Icon name="chevron" size={14} />
          </button>
        </div>
      </div>

      <div className="week-days">
        {days.map((d) => {
          const due = on(d);
          const cls = ['wd', sameDay(d, today) && 'today', sameDay(d, selected) && 'sel', d.getDay() % 6 === 0 && 'weekend']
            .filter(Boolean).join(' ');
          return (
            <button key={d} className={cls} onClick={() => setSelected(d)}
              aria-label={`${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}, ${due.length} due`}>
              <span className="wd-name">{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              <span className="wd-num">{d.getDate()}</span>
              <span className="wd-dots">
                {due.slice(0, 4).map((x) => <i key={x.id} className={done.has(x.id) ? 'done' : ''} />)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="week-list">
        {items.length === 0
          ? <span className="muted">Nothing due {sameDay(selected, today) ? 'today' : selected.toLocaleDateString(undefined, { weekday: 'long' })}.</span>
          : items.map((x) => (
            <div key={x.id} className={`week-item ${done.has(x.id) ? 'done' : ''}`}>
              <i />
              <div>
                {x.url
                  ? <a href={x.url} target="_blank" rel="noreferrer"><strong>{x.title}</strong></a>
                  : <strong>{x.title}</strong>}
                <span>
                  {x.courseUrl
                    ? <a href={x.courseUrl} target="_blank" rel="noreferrer">{courseCode(x.course)}</a>
                    : courseCode(x.course)}, {dueLabel(x.due)}
                </span>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
